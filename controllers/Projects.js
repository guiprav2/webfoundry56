import rfiles from '../repos/rfiles.js';
import rprojects from '../repos/rprojects.js';

export default class Projects {
  state = { list: [] };

  actions = {
    init: async () => {
      let { bus } = state.event;
      bus.on('projects:create:ready', async () => await post('projects.load'));
      bus.on('projects:mv:ready', async () => await post('projects.load'));
      bus.on('projects:rm:ready', async () => await post('projects.load'));
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
      let [btn, name] = await showModal('PromptDialog', { title: 'Create project', placeholder: 'Project name', allowEmpty: false });
      if (btn !== 'ok') return bus.emit('projects:create:cancel');
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
      let [btn, newName] = await showModal('PromptDialog', { title: 'Rename project', placeholder: 'Project name', initialValue: name, allowEmpty: false });
      if (btn !== 'ok') return bus.emit('projects:mv:cancel');
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
