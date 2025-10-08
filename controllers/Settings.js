import rprojects from '../repos/rprojects.js';

export default class Settings {
  state = {};

  actions = {
    init: async () => {
      let { bus } = state.event;
      this.state.opt = JSON.parse(localStorage.getItem('webfoundry:config') || 'null');
      if (!this.state.opt) {
        this.state.opt = {
          companion: false,
          companionKey: `wf-${crypto.randomUUID()}`,
        };
        await post('settings.save');
      }
      bus.on('projects:select:ready', async () => {
        let project = state.projects.current;
        this.state.popt = await rprojects.config(project);
        this.state.popt.storage = localStorage.getItem(`webfoundry:projects:storage:${project.split(':')[1]}`);
      });
      ['save', 'rm'].forEach(x => bus.on(`files:${x}`, async ({ event, path }) => {
        let project = state.projects.current;
        let name = project.split(':')[0];
        if (path !== `${name}/wf.uiconfig.json`) return;
        bus.emit('settings:projects:reload:start', { project });
        this.state.popt = await rprojects.config(project);
        this.state.popt.storage = localStorage.getItem(`webfoundry:projects:storage:${project.split(':')[1]}`);
        d.update();
        bus.emit('settings:projects:reload:ready', { project, opt: this.state.popt });
      }));
      ['push', 'pull'].forEach(x => bus.on(`broadcast:files:${x}`, async ({ project }) => {
        if (state.projects.current !== project) return;
        bus.emit('settings:projects:reload:start', { project });
        this.state.popt = await rprojects.config(project);
        this.state.popt.storage = localStorage.getItem(`webfoundry:projects:storage:${project.split(':')[1]}`);
        d.update();
        bus.emit('settings:projects:reload:ready', { project, opt: this.state.popt });
      }));
    },

    save: () => localStorage.setItem('webfoundry:config', JSON.stringify(this.state.opt)),

    option: async (k, v, force) => {
      v ??= !this.state.opt[k];
      let { bus } = state.event;
      if (!force) {
        let prevented = false;
        await bus.emitAsync('settings:global:option:start', { k, v, preventDefault: () => prevented = true });
        if (prevented) return bus.emit('settings:global:option:abort', { k, v });
      }
      this.state.opt[k] = v;
      await post('settings.save');
      bus.emit('settings:global:option:ready', { k, v });
    },

    projectOption: async (k, v, force) => {
      v ??= !this.state.popt[k];
      let project = state.projects.current;
      let { bus } = state.event;
      if (!force) {
        let prevented = false;
        await bus.emitAsync('settings:projects:option:start', { k, v, preventDefault: () => prevented = true });
        if (prevented) return bus.emit('settings:projects:option:abort', { k, v });
      }
      this.state.popt[k] = v;
      if (k === 'storage') localStorage.setItem(`webfoundry:projects:storage:${project.split(':')[1]}`, v);
      else await rprojects.config(project, { ...this.state.popt, storage: undefined });
      bus.emit('settings:projects:option:ready', { k, v });
    },
  };
};
