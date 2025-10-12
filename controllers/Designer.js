import BiMap from '../other/bimap.js';
import Boo from 'https://esm.sh/@camilaprav/boo@1.0.6';
import actions from '../other/actions.js';
import htmlsnap from 'https://esm.sh/@camilaprav/htmlsnap@0.0.13';
import morph from 'https://esm.sh/nanomorph';
import prettier from '../other/prettier.js';
import rfiles from '../repos/rfiles.js';
import { arrayify, debounce } from '../other/util.js';
import { defaultHead } from '../other/templates.js';

export default class Designer {
  state = {
    toolbar: 'manipulation',

    get tagLabel() {
      let s = this.current.cursors[state.collab.uid];
      if (s?.length !== 1) return 'Tag';
      return `<${this.current.map.get(s[0]).tagName.toLowerCase()}>`;
    },

    list: [],

    frameVisible(path) {
      let frame = this.list.find(x => x.path === path);
      return state.files.current === path && frame.ready;
    },

    src(path) {
      let frame = this.list.find(x => x.path === path);
      let [name, uuid] = state.projects.current.split(':');
      if (frame.preview) path = path.slice('pages/'.length);
      return `/${frame.preview ? 'preview' : 'files'}/${sessionStorage.webfoundryTabId}/${name}:${uuid}/${path}`;
    },

    get current() { return this.list.find(x => x.path === state.files.current) },
    get open() { return this.current?.ready },
    frameWidth: 'calc(100% - 1rem)',
    frameHeight: '100%',
    clipboards: {},
  };

  actions = {
    init: async () => {
      let { bus } = state.event;
      bus.on('projects:select:ready', async () => await post('designer.reset'));
      bus.on('files:select:ready', async ({ path }) => {
        if (!/^(components|pages)\/.*\.html$/.test(path)) return;
        await post('designer.select', path);
      });
      bus.on('files:change', async ({ path }) => {
        let name = state.projects.current.split(':')[0];
        if (!path.startsWith(`${name}/`)) return;
        //state.designer.open && state.files.current === path.slice(`${name}/`.length) && await post('designer.repatch');
      });
      addEventListener('keydown', async ev => await post('designer.keydown', ev, true), true);
      await post('designer.trackCursors');
    },

    reset: () => this.state.list = [],

    select: async path => {
      if (this.state.list.find(x => x.path === path)) return;
      if (!path?.startsWith?.('pages/')) return;
      let { bus } = state.event;
      let project = state.projects.current;
      let p = Promise.withResolvers();
      this.state.list.push({
        path,
        get doc() { return this.el?.contentDocument },
        get html() { return this.doc?.documentElement },
        get head() { return this.doc?.head },
        get body() { return this.doc?.body },
        preview: false,
        mutobs: null,
        snap: null,
        map: new BiMap(),
        cursors: {},
        lastCursors: {},
        overlays: {},
        history: {},
        ihistory: {},
        resolve: p.resolve,
        reject: p.reject,
      });
      d.update();
      await loadman.run('designer.select', async () => {
        try {
          await p.promise;
          bus.emit('designer:select:ready', { project, path });
        } catch (err) {
          console.error(err);
          this.state.list = this.state.list.filter(x => x.path !== path);
          bus.emit('designer:select:error', { project, path, err });
        }
      }, true);
    },

    hookFrameWidth: el => d.el(el, { style: { width: () => this.state.frameWidth } }),

    frameAttach: (path, el) => {
      let frame = this.state.list.find(x => x.path === path);
      if (!frame) throw new Error(`Designer frame not found: ${path}`);
      frame.el = el;
    },

    frameReady: async (path, err) => {
      let frame = this.state.list.find(x => x.path === path);
      if (!frame) throw new Error(`Designer frame not found: ${path}`);
      if (!frame.el) return; // ???
      let { bus } = state.event;
      if (err) { frame.reject(err); bus.emit('designer:frame:error', { frame, err }); return }
      if (!frame.preview) {
        frame.mutobs = new MutationObserver(async () => {
          await post('designer.maptrack', frame);
          await post('designer.save', frame);
        });
        frame.mutobs.observe(frame.html, { attributes: true, subtree: true, childList: true, characterData: true });
        await post('designer.maptrack', frame);
        frame.html.addEventListener('mousedown', async ev => await post('designer.mousedown', ev), true);
        frame.html.addEventListener('click', ev => ev.preventDefault(), true);
        frame.html.addEventListener('dblclick', async ev => await post('designer.dblclick', ev), true);
        frame.html.addEventListener('keydown', async ev => await post('designer.keydown', ev), true);
      }
      if (!frame.heightHooked) { d.el(frame.el, { style: { height: () => this.state.frameHeight } }); frame.heightHooked = true }
      frame.ready = true;
      frame.resolve();
      bus.emit('designer:frame:ready', { frame });
    },

    maptrack: async frame => [frame.snap, frame.map] = htmlsnap(frame.html, { idtrack: true, map: frame.map }),

    trackCursors: async () => {
      requestAnimationFrame(async () => await post('designer.trackCursors'));
      let frame = this.state.current;
      if (!frame) return;
      if (frame.preview) {
        frame.cursors = {};
        for (let xs of Object.values(frame.overlays)) for (let x of xs) x.disable();
        frame.overlays = {};
        return;
      }
      for (let [k, ids] of Object.entries(frame.cursors)) {
        let ovs = (frame.overlays[k] ??= []);
        while (ids.length > ovs.length) {
          let i = ovs.length;
          let p = state.collab.rtc?.presence?.find?.(x => x.user === k);
          let o = d.el('div', { class: ['hidden border z-10 pointer-events-none', () => !p ? 'border-blue-400' : `border-${p.color}`] });
          document.body.append(o);
          ovs.push(new Boo(o, () => frame.map.get(frame.cursors[k][i]), { transitionClass: 'transition-all', containerOverlayPosition: 'start' }));
        }
        while (ovs.length > ids.length) ovs.pop().disable();
      }
    },

    toolbar: async (k, params) => {
      if (/^(manipulation|tailwind)$/.test(k)) { this.state.toolbar = k; return }
      await actions[k].handler({ cur: state.collab.uid, ...params });
    },

    mousedown: async ev => {
      let frame = this.state.current;
      frame.el.focus();
      frame.doc.activeElement.blur();
      ev.preventDefault();
      if (!ev.shiftKey) await actions.changeSelection.handler({ cur: state.collab.uid, s: [frame.map.getKey(ev.target)] });
      else await actions.changeSelection.handler({ cur: state.collab.uid, s: [...new Set([...frame.cursors[state.collab.uid] || [], frame.map.getKey(ev.target)])] });
    },

    dblclick: async ev => {
      if (!/^HTML(InputElement|TextAreaElement)$/.test(ev.target.constructor.name)) return;
      ev.target.select();
    },

    keydown: async (ev, external) => {
      // FIXME: Slave support
      if (/^input|textarea|button$/i.test(external ? document.activeElement.tagName : this.state.current.doc.activeElement.tagName)) {
        if (ev.key === 'Escape') ev.target.blur();
        return;
      }
      let key = ev.key;
      if (ev.altKey && ev.key !== 'Alt') key = `Alt-${key}`;
      if (ev.ctrlKey && ev.key !== 'Control') key = `Ctrl-${key}`;
      if (key === 'Control') key = 'Ctrl';
      let [k, cmd] = [...Object.entries(actions)].find(kv => arrayify(kv[1].shortcut).includes(key)) || [];
      if (!cmd || cmd?.disabled?.({ cur: state.collab.uid })?.filter?.(Boolean)?.length) return;
      ev.preventDefault();
      await cmd.handler({ cur: state.collab.uid });
    },

    save: debounce(async frame => {
      let project = state.projects.current;
      let body = frame.body.cloneNode(true);
      body.style.display = 'none';
      let betterscroll = true;
      let html = `<!doctype html><html>${defaultHead({ betterscroll })}${body.outerHTML}</html>`;
      await rfiles.save(project, frame.path, new Blob([html], { type: 'text/html' }));
      let phtml = await prettier(html, { parser: 'html' });
      if (phtml === html) return;
      await rfiles.save(project, frame.path, new Blob([phtml], { type: 'text/html' }));
      state.event.bus.emit('designer:save:ready', { project, path: frame.path });
    }, 200),

    resize: ev => {
      ev.target.setPointerCapture(ev.pointerId);
      let canvas = document.querySelector('#Canvas');
      let crect = canvas.getBoundingClientRect();
      let lpadder = document.querySelector('.Designer-leftPadder');
      let move = mev => {
        let ifrect = document.querySelector('.Designer-activeFrame').getBoundingClientRect();
        let w = `${Math.max(320, (mev.clientX - (crect.left + crect.width / 2)) * 2)}px`;
        if (parseInt(w, 10) >= crect.width - 16) w = '100%';
        this.state.frameWidth = `min(100% - 1rem, ${w})`;
        d.updateSync();
        let ifs = getComputedStyle(document.querySelector('.Designer-activeFrame'));
        let ifw = Number(ifs.width.replace(/px$/, ''));
        this.state.frameHeight = ifw < 640 ? `min(100%, ${ifw * 1.666}px)` : '100%';
        d.updateSync();
        ifs = getComputedStyle(document.querySelector('.Designer-activeFrame'));
        state.event.bus.emit('designer:resize:ready', { width: ifs.width, height: ifs.height });
      };
      ev.target.addEventListener('pointermove', move);
      ev.target.addEventListener('pointerup', () => {
        ev.target.removeEventListener('pointermove', move);
        ev.target.releasePointerCapture(ev.pointerId);
      }, { once: true });
    },

    togglePreview: async () => {
      let frame = this.state.current;
      let p = Promise.withResolvers();
      Object.assign(frame, { ready: false, resolve: p.resolve, reject: p.reject, preview: !frame.preview });
      d.update();
      await loadman.run('designer.togglePreview', async () => {
        await p.promise;
        state.event.bus.emit('designer:togglePreview:ready', { preview: frame.preview });
      });
    },

    refresh: async () => {
      let frame = this.state.current;
      let p = Promise.withResolvers();
      Object.assign(frame, { ready: false, resolve: p.resolve, reject: p.reject });
      d.update();
      await loadman.run('designer.refresh', async () => { frame.el.src = frame.el.src; await p.promise });
    },

    repatch: async () => {
      let frame = this.state.current;
      if (!this.state.open || !frame) return;
      let project = state.projects.current;
      let path = state.files.current;
      try {
        let blob = await rfiles.load(project, path);
        let text = await blob.text();
        let doc = new DOMParser().parseFromString(text, 'text/html');
        let { mutobs } = frame;
        mutobs?.disconnect?.();
        morph(frame.body, doc.body);
        frame.body.style.display = '';
        mutobs?.observe?.(frame.html, { attributes: true, subtree: true, childList: true, characterData: true });
        state.event.bus.emit('designer:repatch:ready', { project, path });
      } catch (err) {
        console.error(err);
        state.event.bus.emit('designer:repatch:error', { project, path, error: err });
      }
    },

    pushHistory: async (cur, op) => {
      let frame = this.state.current;
      frame.history[cur] ??= [];
      frame.ihistory[cur] ??= 0;
      if (frame.history[cur].length > frame.ihistory[cur]) frame.history[cur].splice(frame.ihistory[cur], frame.history[cur].length);
      await op(true);
      frame.history[cur].push(op);
      ++frame.ihistory[cur];
    },
  };
};
