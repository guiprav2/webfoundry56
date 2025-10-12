import rfiles from '../repos/rfiles.js';
import rprojects from '../repos/rprojects.js';
import { defaultHtml } from '../other/templates.js';

export default class Projects {
  state = { list: [] };

  actions = {
    init: async () => {
      let { bus } = state.event;
      bus.on('projects:create:ready', async ({ project }) => {
        await post('projects.load');
        await new Promise(pres => setTimeout(pres, 1000));
        await post('projects.select', project);
      });
      bus.on('projects:mv:ready', async ({ project, newName }) => {
        await post('projects.load');
        await new Promise(pres => setTimeout(pres, 1000));
        await post('projects.select', `${newName}:${project.split(':')[1]}`);
      });
      bus.on('projects:rm:ready', async ({ project }) => {
        if (this.state.current === project) await post('projects.select', null);
        await post('projects.load');
      });
      bus.on('settings:global:option:ready', async ({ k, v }) => {
        if (k !== 'companion' || v) return;
        if (rprojects.storage(state.projects.current) === 'cfs') await post('projects.select', null);
      });
      await post('projects.load');
    },

    load: async () => {
      let { bus } = state.event;
      bus.emit('projects:load:start');
      this.state.list = rprojects.list();
      bus.emit('projects:load:ready');
    },

    create: async (opt = {}) => {
      let { bus } = state.event;
      bus.emit('projects:create:start');
      bus.emit('projects:create:prompt');
      let name;
      while (true) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Create project', placeholder: 'Project name', initialValue: name, allowEmpty: false, short: true });
        if (btn !== 'ok') return bus.emit('projects:create:cancel');
        name = val;
        if (state.projects.list.find(x => x.split(':')[0] === val)) { await showModal('InfoDialog', { title: `Project already exists.` }); continue }
        break;
      }
      await loadman.run('projects.create', async () => {
        bus.emit('projects:create:confirmed', { name });
        let project = rprojects.create(name);
        let uuid = project.split(':')[1];
        opt.nerdfonts ??= true;
        opt.tailwind ??= true;
        opt.betterscroll ??= true;
        state.projects.list.push(project); // needed by rprojects.config
        await rprojects.config(project, opt);
        await Promise.all(['controllers', 'components', 'media', 'pages'].map(async x => await rfiles.save(project, `${x}/.keep`, new Blob([''], { type: 'text/plain' }))));
        await Promise.all([
          'index.html',
          'webfoundry/wf.config.js',
          'webfoundry/app.js',
          'webfoundry/head.js',
          'webfoundry/dominant.js',
          'webfoundry/tailplay4.dafuq.js',
        ].map(async x => await rfiles.save(project, !x.endsWith('/wf.config.js') ? x : 'wf.config.js', await (await fetch(x)).blob())));
        await rfiles.save(project, 'pages/index.html', new Blob([defaultHtml], { type: 'text/html' }));
        bus.emit('projects:create:ready', { project });
      });
    },

    select: project => {
      let { bus } = state.event;
      bus.emit('projects:select:start', { project });
      this.state.current = project;
      bus.emit('projects:select:ready', { project });
    },

    mv: async project => {
      let { bus } = state.event;
      let [name, uuid] = project.split(':');
      bus.emit('projects:mv:start', { project });
      bus.emit('projects:mv:prompt', { project });
      let newName;
      while (true) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Rename project', placeholder: 'Project name', initialValue: newName || name, allowEmpty: false, short: true });
        if (btn !== 'ok') return bus.emit('projects:mv:cancel');
        newName = val;
        if (state.projects.list.find(x => x.split(':')[0] === val)) { await showModal('InfoDialog', { title: `Project already exists.` }); continue }
        break;
      }
      await loadman.run('projects.mv', async () => {
        bus.emit('projects:mv:confirmed', { project, newName });
        await rprojects.mv(project, newName);
        bus.emit('projects:mv:ready', { project, newName });
      });
    },

    rm: async project => {
      let { bus } = state.event;
      bus.emit('projects:rm:start', { project });
      bus.emit('projects:rm:confirm', { project });
      let [btn] = await showModal('ConfirmationDialog', { title: 'Delete project?' });
      if (btn !== 'yes') return bus.emit('projects:rm:cancel', { project });
      await loadman.run('projects.rm', async () => {
        bus.emit('projects:rm:confirmed', { project });
        await rprojects.rm(project);
        bus.emit('projects:rm:ready', { project });
      });
    },
  };
};
