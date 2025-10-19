import * as pako from 'https://esm.sh/pako';
import prettier from '../other/prettier.js';
import rfiles from '../repos/rfiles.js';
import rprojects from '../repos/rprojects.js';
import structuredFiles from '../other/structuredFiles.js';
import { debounce, joinPath, loadman } from '../other/util.js';
import { defaultCtrl, defaultHtml } from '../other/templates.js';
import { lookup as mimeLookup } from 'https://cdn.skypack.dev/mrmime';

export default class Files {
  state = {
    list: [],
    expandedPaths: new Set(),

    expanded: path => {
      if (!path) return true;
      let paths = [];
      let currentPath = '';
      for (let part of path.split('/').slice(0, -1)) { currentPath += `${part}/`; paths.push(currentPath) }
      return paths.every(x => this.state.expandedPaths.has(x));
    },

    protected: path => ['components', 'controllers', 'media', 'pages'].includes(path),
  };

  actions = {
    init: () => {
      let { bus } = state.event;
      let allowedOrigin = origin => {
        try {
          let url = new URL(origin);
          let host = url.hostname;
          let base = location.hostname;
          return host === base || host.endsWith(`.${base}`);
        } catch {
          return false;
        }
      };

      let respond = async ({ project, path }, callback) => {
        try {
          path = decodeURIComponent(path);
          if (!project?.includes?.(':')) return callback({ type: 'fetch:res', project, path, status: 400, error: 'Bad project' });
          let data = state.collab.uid === 'master'
            ? await rfiles.load(project, path)
            : await ungzblob(unb64(await post('collab.rpc', 'fetch', { project, path })), mimeLookup(path));
          if (!data) return callback({ type: 'fetch:res', project, path, status: 404, error: 'Not found' });
          callback({ type: 'fetch:res', project, path, status: 200, data });
        } catch (err) {
          console.error(err);
          callback({ type: 'fetch:res', project, path, status: 500, error: err.message });
        }
      };

      navigator.serviceWorker.addEventListener('message', async event => {
        let { type, project, path } = event.data || {};
        if (type !== 'fetch') return;
        console.log('wf fetch:', project, path);
        let port = event.ports?.[0];
        if (!port) return;
        await respond({ project, path }, payload => port.postMessage(payload));
      });

      window.addEventListener('message', async event => {
        let { type, project, path } = event.data || {};
        if (type !== 'fetch') return;
        if (!allowedOrigin(event.origin)) return;
        if (!event.source || typeof event.source.postMessage !== 'function') return;
        console.log('wf fetch:', project, path);
        await respond({ project, path }, payload => event.source.postMessage(payload, event.origin));
      });
      if (state.collab.uid !== 'master') return;
      bus.on('projects:select:ready', async ({ project }) => await loadman.run('files.projectSelect', async () => {
        this.state.list = [];
        this.state.expandedPaths = new Set(['pages/']);
        this.state.current = null;
        d.update();
        if (project) {
          await post('files.load');
          if (state.app.panel === 'projects') await post('app.selectPanel', 'files');
        }
      }));
      bus.on('files:select:ready', ({ path }) => {
        if (!path || path.endsWith('/')) return;
        let parts = path.split('/').slice(0, -1);
        let partial = '';
        for (let i = 0; i < parts.length; i++) {
          partial += `${parts[i]}/`;
          this.state.expandedPaths.add(partial);
        }
      });
      bus.on('files:create:ready', async ({ path }) => {
        await new Promise(pres => setTimeout(pres, 1000));
        await post('files.select', path);
      });
      bus.on('files:mv:ready', async ({ path, newPath }) => {
        let { current } = this.state;
        await post('files.load');
        if (current === path || (path.endsWith('/') && current?.startsWith?.(path))) {
          if (!path.endsWith('/')) await post('files.select', newPath);
          else await post('files.select', current.replace(new RegExp(`^${path}`), newPath));
        }
      });
      bus.on('files:rm:ready', async () => await post('files.load'));
      for (let x of ['add', 'change', 'rm']) {
        bus.on(`broadcast:files:${x}`, ({ event, path }) => {
          let name = path.split('/')[0];
          let storage = rprojects.storage(state.projects.list.find(x => x.startsWith(`${name}:`)));
          if (storage !== 'local') return;
          bus.emit(event.split(':').slice(1).join(':'), { path });
        });
        bus.on(`companion:files:${x}`, ({ event, path }) => {
          let name = path.split('/')[0];
          let project = state.projects.list.find(x => x.startsWith(`${name}:`));
          if (!project) return;
          let storage = rprojects.storage(project);
          if (storage !== 'cfs') return;
          bus.emit(event.split(':').slice(1).join(':'), { path });
        });
        bus.on(`files:${x}`, async ({ path }) => {
          if (!state.projects.current || !path.startsWith(`${state.projects.current.split(':')[0]}/`)) return;
          x !== 'change' && await post('files.load');
          if (!path.endsWith('.html') && !path.endsWith('.js')) return;
          (path.endsWith('.html') || x !== 'change') && await post('files.reflect');
        });
      }
      ['push', 'pull'].forEach(x => bus.on(`broadcast:files:${x}`, async () => await post('files.load')));
      bus.on('settings:projects:option:start', async ({ k, v, preventDefault }) => {
        if (k !== 'storage') return;
        preventDefault();
        let project = state.projects.current;
        let [btn] = await showModal('ConfirmationDialog', { title: 'Ya sure?' });
        if (btn !== 'yes') return;
        await post(v === 'local' ? 'files.push' : 'files.pull');
      });
    },

    load: debounce(async () => await loadman.run('files.load', async () => {
      let project = state.projects.current;
      let { bus } = state.event;
      bus.emit('files:load:start');
      let list = (await rfiles.list(project)).filter(x => !/(\..*\.sw.$|^index.html$|^wf.uiconfig.json$|^webfoundry\/)/.test(x));
      if (state.projects.current !== project) return bus.emit('files:load:abort');
      if (!list.includes(this.state.current)) await post('files.select', null);
      this.state.list = structuredFiles(list);
      bus.emit('files:load:ready');
    }), 500),

    select: path => {
      if (state.collab.uid !== 'master') return;
      let project = state.projects.current;
      let { bus } = state.event;
      bus.emit('files:select:start');
      if (path?.endsWith?.('/')) {
        if (this.state.expandedPaths.has(path)) this.state.expandedPaths.delete(path);
        else this.state.expandedPaths.add(path);
      } else {
        this.state.current = path;
      }
      bus.emit('files:select:ready', { project, path });
    },

    create: async path => {
      let project = state.projects.current;
      let { bus } = state.event;
      bus.emit('files:create:start');
      let [btn, type, name] = await showModal('CreateFileDialog');
      if (btn !== 'ok') return bus.emit('files:create:abort', { project, path });
      if (type === 'file' && !name.includes('.') && (path === 'pages' || path?.startsWith?.('pages/'))) {
        let [choice] = await showModal('FileExtensionWarningDialog');
        if (!choice) return bus.emit('files:create:abort', { project, path });
        if (choice === 'html') name += '.html';
      }
      let fullpath = path ? joinPath(path, name) : name;
      if (await rfiles.load(project, fullpath)) {
        let [btn2] = await showModal('ConfirmationDialog', { title: 'File exists. Overwrite?' });
        if (btn2 !== 'yes') return bus.emit('files:create:abort', { project, path, name });
      }
      if (type === 'file') {
        let defaultContent = '';
        if (fullpath.startsWith('controllers/') && fullpath.endsWith('.js')) defaultContent = defaultCtrl(fullpath);
        if (fullpath.endsWith('.html')) defaultContent = defaultHtml({ title: name });
        let iext = name.lastIndexOf('.');
        let parser = iext < 0 ? '' : name.slice(iext + 1);
        defaultContent = await prettier(defaultContent, { parser });
        let blob = new Blob([defaultContent], { type: mimeLookup(fullpath) });
        await loadman.run('files.create', async () => {
          await rfiles.save(project, fullpath, blob);
          bus.emit('files:create:ready', { project, path: fullpath });
        });
      } else {
        await loadman.run('files.create', async () => {
          await rfiles.save(project, `${fullpath}/.keep`, new Blob([''], { type: 'text/plain' }));
          bus.emit('files:create:ready', { project, path: `${fullpath}/.keep` });
        });
      }
    },

    dragstart: (ev, path) => { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', path) },
    dragover: (ev, path) => { ev.preventDefault(); ev.stopPropagation(); ev.dataTransfer.dropEffect = 'move'; this.state.dropTarget = path === '/' ? path : path.slice(0, path.lastIndexOf('/')) },

    drop: async (ev, dest) => {
      let project = state.projects.current;
      ev.preventDefault();
      ev.stopPropagation();
      this.state.dropTarget = null;
      d.update();
      let path = ev.dataTransfer.getData('text/plain');
      let tail = path.split('/').at(path.endsWith('/') ? -2 : -1) + (path.endsWith('/') ? '/' : '');
      let newPath = dest === '/' ? tail : dest.slice(0, dest.lastIndexOf('/') + 1) + tail;
      if (newPath.startsWith(path)) return;
      await rfiles.mv(state.projects.current, path, newPath);
      state.event.bus.emit('files:mv:ready', { project, path, newPath });
    },

    dragend: () => { this.state.dropTarget = null },

    mv: async path => {
      let project = state.projects.current;
      let { bus } = state.event;
      bus.emit('files:mv:start');
      let isDir = path.endsWith('/');
      let [btn, newName] = await showModal('RenameFileDialog', { initialValue: path.split('/').at(isDir ? -2 : -1) });
      if (btn !== 'ok') return bus.emit('files:mv:abort', { project, path });
      let newPath = [...path.split('/').slice(0, isDir ? -2 : -1), newName].join('/') + (isDir ? '/' : '');
      await loadman.run('files.mv', async () => {
        await rfiles.mv(project, path, newPath);
        bus.emit('files:mv:ready', { project, path, newPath });
      });
    },

    rm: async path => {
      let project = state.projects.current;
      let { bus } = state.event;
      bus.emit('files:rm:start');
      let [btn] = await showModal('ConfirmationDialog', { title: 'Delete this file or folder?' });
      if (btn !== 'yes') return bus.emit('files:rm:abort', { project, path });
      await loadman.run('files.rm', async () => {
        await rfiles.rm(project, path);
        bus.emit('files:rm:ready', { project, path });
      });
    },

    reflect: debounce(async () => {
      let project = state.projects.current;
      let files = await rfiles.list(project);
      let templ = {};
      for (let x of files.filter(x => x.endsWith('.html'))) templ[x] = await (await rfiles.load(project, x)).text();
      await rfiles.save(project, 'webfoundry/templates.json', new Blob([JSON.stringify(templ)], { type: 'application/json' }));
      await rfiles.save(project, 'webfoundry/scripts.json', new Blob([JSON.stringify(files.filter(x => x.endsWith('.js')))], { type: 'application/json' }));
    }, 1000),

    push: async () => await loadman.run('files.push', async () => {
      let { bus } = state.event;
      let project = state.projects.current;
      bus.emit('files:push:start');
      await rfiles.push(project);
      await post('settings.projectOption', 'storage', 'local', true);
      await post('broadcast.publish', 'files:push', { project });
      bus.emit('files:push:ready');
    }),

    pull: async () => await loadman.run('files.pull', async () => {
      let { bus } = state.event;
      let project = state.projects.current;
      bus.emit('files:pull:start');
      await rfiles.pull(project);
      await post('settings.projectOption', 'storage', 'cfs', true);
      await post('broadcast.publish', 'files:pull', { project });
      bus.emit('files:pull:ready');
    }),

    deploy: async () => {
      let project = state.projects.current;
      let key = localStorage.getItem('webfoundry:netlifyApiKey');
      if (!key) {
        let [btn, x] = await showModal('NetlifyApiKey', { key });
        if (btn !== 'ok') return;
        key = x;
        localStorage.setItem('webfoundry:netlifyApiKey', key);
      }
      let siteId = localStorage.getItem(`webfoundry:netlifySiteId:${project}`);
      let btn, type, x;
      while (true) {
        [btn, type, x] = await showModal('NetlifyDeploy', { key, id: siteId });
        if (btn === 'key') {
          let key = localStorage.getItem('webfoundry:netlifyApiKey');
          let [btn, x] = await showModal('NetlifyApiKey', { key });
          if (btn !== 'ok') continue;
          key = x;
          localStorage.setItem('webfoundry:netlifyApiKey', key);
          continue;
        }
        if (btn !== 'ok') return;
        break;
      }
      showModal('Loading', { msg: 'Compressing files...' });
      const blob = await rfiles.exportZip(project);
      document.querySelector('dialog')?.remove?.();
      const headers = { Authorization: `Bearer ${key}` };
      if (type === 'new') {
        const res = await fetch('https://api.netlify.com/api/v1/sites', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: x }),
        });
        if (!res.ok) {
          await showModal('NetlifyPostDeploy', { success: false });
          return;
        }
        const json = await res.json();
        siteId = json.id;
      } else if (type === 'existing') {
        siteId = x;
      }
      localStorage.setItem(`webfoundry:netlifySiteId:${project}`, siteId);
      const uploadStart = Date.now();
      showModal('Loading', { msg: 'Deploying to Netlify...' });
      try {
        await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/zip' },
          body: blob,
        });
      } catch (err) {
        !err.message.includes('CORS') && console.error(err);
      }
      const checkDeployStatus = async (timeout = 60000, interval = 3000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, { headers });
          if (res.ok) {
            const deploys = await res.json();
            deploys.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const latestDeploy = deploys[0];
            if (latestDeploy && new Date(latestDeploy.created_at).getTime() >= uploadStart) return latestDeploy;
          }
          await new Promise(resolve => setTimeout(resolve, interval));
        }
        throw new Error('Deploy status check timed out');
      };
      try {
        let x = await checkDeployStatus();
        document.querySelector('dialog')?.remove?.();
        let [btn] = await showModal('NetlifyPostDeploy', { success: true });
        let url = x.ssl_urll || x.url;
        url = this.state.current && !this.state.current.endsWith('/index.html') ? `${url}/${this.state.current.slice('pages/'.length)}` : url;
        btn === 'visit' && open(url, siteId);
      } catch (err) {
        console.error(err);
        await showModal('NetlifyPostDeploy', { success: false });
      }
    },

    importZip: async () => {
      let project = state.projects.current;
      let input = d.html`<input class="hidden" type="file" accept=".zip">`;
      input.onchange = async () => {
        let [file] = input.files;
        if (!file) return;
        showModal('Loading', { msg: 'Importing ZIP...' });
        await rfiles.importZip(project, file);
        await post('files.injectBuiltins');
        await post('files.generateReflections');
        await post('files.load');
        document.querySelector('dialog')?.remove?.();
      }
      document.body.append(input);
      input.click();
      input.remove();
    },

    exportZip: async () => {
      let project = state.projects.current;
      showModal('Loading', { msg: 'Exporting ZIP...' });
      let blob = await rfiles.exportZip(project);
      document.querySelector('dialog')?.remove?.();
      let a = d.html`<a class="hidden" ${{ download: `${project.split(':')[0]}.zip`, href: URL.createObjectURL(blob) }}>`;
      document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    },
  };
};

async function ungzblob(blob, type) {
  if (blob == null) return null;
  return new Blob([pako.ungzip(new Uint8Array(await blob.arrayBuffer()))], { type });
}

function unb64(base64, type = '') {
  if (base64 == null) return null;
  let chars = atob(base64);
  let nums = new Array(chars.length);
  for (let i = 0; i < chars.length; i++) nums[i] = chars.charCodeAt(i);
  return new Blob([new Uint8Array(nums)], { type });
}
