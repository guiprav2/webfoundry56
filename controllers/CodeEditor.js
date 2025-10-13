import rfiles from '../repos/rfiles.js';
import { debounce, isMedia } from '../other/util.js';
import AceCollabBinding from '../other/AceCollab.js';
import { lookup as mimeLookup } from 'https://esm.sh/mrmime';

export default class CodeEditor {
  state = {
    target(path) { return (path && !isMedia(path) && !(/^components\/|pages\//.test(path) && path.endsWith('.html'))) },
    ace: null,
    session: null,
    changeHandler: null,
    binding: null,
    currentPath: null,
    currentProject: null,
    pendingSelection: null,
    ready: false,
  };

  actions = {
    init: () => {
      let { bus } = state.event;
      document.head.append(d.el('style', `
        .ace_editor { background-color: #04060960 !important }
        .ace_gutter { background-color: #060a0f60 !important }
        .ace_active-line { background-color: #0009 !important }
        .ace_gutter-active-line { background-color: #0009 !important }
      `));
      let script = d.el('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.23.4/ace.js' });
      let applySelection = async (project, path, opt = {}) => {
        this.state.pendingSelection = null;
        if (!window.ace || !this.state.ready) {
          this.state.pendingSelection = { project, path, opt };
          return;
        }
        await this.actions.open(project, path, opt);
      };
      bus.on('files:select:ready', async ({ project, path }) => {
        await applySelection(project, path);
      });
      bus.on('collab:apply:ready', async () => {
        if (state.collab.uid === 'master') return;
        if (!state.files.current) return;
        let force = !this.state.currentPath || this.state.currentPath !== state.files.current;
        await applySelection(state.projects.current, state.files.current, { force });
      });
      script.onload = async () => {
        this.state.ready = true;
        if (this.state.pendingSelection) {
          let { project, path, opt } = this.state.pendingSelection;
          this.state.pendingSelection = null;
          await this.actions.open(project, path, opt);
        }
        bus.emit('codeEditor:init:ready');
      };
      script.onerror = err => bus.emit('codeEditor:script:error', { error: err });
      document.head.append(script);
      bus.on('settings:global:option:ready', ({ k, v}) => {
        if (k !== 'vim') return;
        this.state.ace?.setKeyboardHandler?.(v ? 'ace/keyboard/vim' : null);
      });
    },

    open: async (project, path, { force = false } = {}) => {
      if (!path) {
        await this.actions.reset();
        return;
      }
      if (!this.state.target(path)) return;
      let type = mimeLookup(path);
      if (!type?.startsWith?.('text/') || type === 'text/html') return;
      project ??= state.projects.current;
      if (!window.ace || !this.state.ready) {
        this.state.pendingSelection = { project, path, opt: { force } };
        return;
      }
      if (!force && this.state.currentPath === path) return;
      await this.actions.reset();

      d.updateSync();
      let wrapper = document.querySelector('#CodeEditor');
      if (!wrapper) return;
      let el = d.el('div', { class: 'w-full h-full' });
      wrapper.replaceChildren(el);

      let editor = ace.edit(el);
      this.state.ace = editor;
      this.state.currentPath = path;
      this.state.currentProject = project;

      editor.setFontSize(state.settings.opt.codeFontSize || '16px');
      editor.setTheme(`ace/theme/${state.settings.opt.codeTheme || 'monokai'}`);
      state.settings.opt.vim && editor.setKeyboardHandler('ace/keyboard/vim');
      let mode = { html: 'html', css: 'css', js: 'javascript', md: 'markdown' }[path.split('.').pop()];
      mode && editor.session.setMode(`ace/mode/${mode}`);
      editor.session.setTabSize(state.settings.opt.codeTabSize || 2);
      editor.session.setOption('useWorker', false);

      if (state.collab.uid === 'master') {
        let blob = await rfiles.load(project, path);
        let value = await blob.text();
        editor.session.setValue(value);
      }

      editor.session.getUndoManager().reset();
      this.state.binding = new AceCollabBinding({ editor, path, project });

      let changeHandler = async () => {
        if (!this.state.ace) return;
        if (state.collab.uid !== 'master') return;
        if (this.state.binding?.isApplyingRemote?.()) return;
        await post('codeEditor.change');
      };
      editor.session.on('change', changeHandler);
      this.state.session = editor.session;
      this.state.changeHandler = changeHandler;

      editor.focus();
    },

    reset: async () => {
      this.state.binding?.destroy?.();
      this.state.binding = null;
      if (this.state.session && this.state.changeHandler) {
        this.state.session.off?.('change', this.state.changeHandler);
        this.state.session.removeListener?.('change', this.state.changeHandler);
      }
      this.state.session = null;
      this.state.changeHandler = null;
      if (this.state.ace) {
        this.state.ace.destroy();
        this.state.ace = null;
      }
      this.state.currentPath = null;
      this.state.currentProject = null;
      let wrapper = document.querySelector('#CodeEditor');
      if (wrapper) wrapper.innerHTML = '';
    },

    change: debounce(async () => {
      if (!this.state.ace || !state.files.current) return;
      let type = mimeLookup(state.files.current);
      await rfiles.save(state.projects.current, state.files.current, new Blob([this.state.ace.session.getValue()], { type }));
    }, 200),
  };
}
