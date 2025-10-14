import rfiles from '../repos/rfiles.js';
import { debounce, isMedia } from '../other/util.js';
import * as pako from 'https://esm.sh/pako';
import { lookup as mimeLookup } from 'https://esm.sh/mrmime';

export default class CodeEditor {
  state = {
    target(path) { return (path && !isMedia(path) && !(/^components\/|pages\//.test(path) && path.endsWith('.html'))) },
    ace: null,
    session: null,
    changeHandler: null,
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
      let script = d.el('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.43.3/ace.js' });
      bus.on('files:select:ready', async ({ project, path }) => await post('codeEditor.open'));
      /*
      bus.on('collab:apply:ready', async () => {
        if (state.collab.uid === 'master') return;
        if (!state.files.current) return;
        await post('codeEditor.open');
      });
      */
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

    open: async () => {
      let project = state.projects.current;
      let path = state.files.current;
      if (!path) return await post('codeEditor.reset');
      if (!this.state.target(path)) return;
      let type = mimeLookup(path);
      if (!type?.startsWith?.('text/') || type === 'text/html') return;
      if (this.state.currentPath === path) return;
      await post('codeEditor.reset');
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
      let blob = state.collab.uid === 'master' ? await rfiles.load(project, path) : await fetchRemoteBlob(project, path, type);
      editor.session.setValue(await blob.text());
      editor.session.getUndoManager().reset();
      let changeHandler = async () => {
        if (!this.state.ace) return;
        if (state.collab.uid !== 'master') return;
        await post('codeEditor.change');
      };
      editor.session.on('change', changeHandler);
      this.state.session = editor.session;
      this.state.changeHandler = changeHandler;
      editor.focus();
    },

    reset: async () => {
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

async function fetchRemoteBlob(project, path, type) {
  try {
    let data = await post('collab.rpc', 'fetch', { project, path });
    if (!data) return null;
    let chars = atob(data);
    let nums = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) nums[i] = chars.charCodeAt(i);
    let unpacked = pako.ungzip(nums);
    return new Blob([unpacked], { type });
  } catch (err) {
    console.error('CodeEditor fetchRemoteBlob error', err);
    return null;
  }
}
