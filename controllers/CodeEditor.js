import rfiles from '../repos/rfiles.js';
import { debounce, isMedia } from '../other/util.js';
import { loadCodeMirrorBase, mountCodeMirror } from '../other/codemirror.js';
import { createYjsBackend } from '../components/CodeEditor.js';
import { lookup as mimeLookup } from 'https://esm.sh/mrmime';

export default class CodeEditor {
  state = {
    target(path) { return (path && !isMedia(path) && !(/^components\/|pages\//.test(path) && path.endsWith('.html'))) },
    editorHandle: null,
    yBackend: null,
    changeHandler: null,
    currentPath: null,
    currentProject: null,
    pendingSelection: null,
    ready: false,
  };

  actions = {
    init: () => {
      let { bus } = state.event;
      if (!document.getElementById('CodeEditorStyles')) {
        document.head.append(d.el('style', { id: 'CodeEditorStyles' }, `
          .CodeMirror { height: 100%; background-color: #04060960 !important; height: 100%; }
          .CodeMirror-gutters { background-color: #060a0f60 !important; }
          .CodeMirror-activeline-background { background-color: #0009 !important; }
          .CodeMirror-activeline .CodeMirror-gutter-elt { background-color: #0009 !important; }
          .CodeMirror-lines > div > :nth-child(3) { display: none }
        `));
      }
      bus.on('files:select:ready', async ({ project, path }) => await post('codeEditor.open'));
      bus.on('collab:apply:ready', async () => {
        if (state.collab.uid === 'master') return;
        if (!state.files.current) return;
        await post('codeEditor.open');
      });
      loadCodeMirrorBase()
        .then(async () => {
          this.state.ready = true;
          if (this.state.pendingSelection) {
            this.state.pendingSelection = null;
            await this.actions.open();
          }
          bus.emit('codeEditor:init:ready');
        })
        .catch(err => bus.emit('codeEditor:script:error', { error: err }));
      bus.on('settings:global:option:ready', async ({ k, v }) => {
        switch (k) {
          case 'vim':
            await this.state.editorHandle?.setKeyMap?.(v ? 'vim' : 'default');
            break;
          case 'codeTheme': {
            let theme = v || state.settings.opt.codeTheme || 'monokai';
            await this.state.editorHandle?.setTheme?.(theme);
            break;
          }
          case 'codeFontSize': {
            let size = state.settings.opt.codeFontSize || v || '16px';
            let wrap = this.state.editorHandle?.editor?.getWrapperElement?.();
            if (wrap) {
              wrap.style.fontSize = typeof size === 'number' ? `${size}px` : size;
              this.state.editorHandle.editor.refresh();
            }
            break;
          }
          case 'codeTabSize': {
            let size = Number(v ?? state.settings.opt.codeTabSize) || 2;
            this.state.editorHandle?.editor?.setOption?.('tabSize', size);
            this.state.editorHandle?.editor?.setOption?.('indentUnit', size);
            break;
          }
          default:
            break;
        }
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
      if (!this.state.ready) {
        this.state.pendingSelection = true;
        return;
      }
      await post('codeEditor.reset');
      d.updateSync();
      let wrapper = document.querySelector('#CodeEditor');
      if (!wrapper) return;
      let el = d.el('div', { class: 'w-full h-full' });
      wrapper.replaceChildren(el);
      let tabSize = state.settings.opt.codeTabSize || 2;
      let fontSize = state.settings.opt.codeFontSize || '16px';
      let modeKey = { html: 'html', css: 'css', js: 'javascript', md: 'markdown' }[path.split('.').pop()?.toLowerCase?.()] ?? null;
      let { editor, destroy, setTheme, setKeyMap, setMode } = await mountCodeMirror(el, {
        mode: modeKey,
        theme: state.settings.opt.codeTheme || 'monokai',
        keyMap: state.settings.opt.vim ? 'vim' : 'default',
        tabSize,
        fontSize,
        lineWrapping: false,
      });
      this.state.editorHandle = { editor, destroy, setTheme, setKeyMap, setMode };
      this.state.currentPath = path;
      this.state.currentProject = project;
      let initialText = '';
      if (state.collab.uid === 'master') {
        let blob = await rfiles.load(project, path);
        initialText = blob ? await blob.text() : '';
      }
      this.state.yBackend?.destroy?.();
      this.state.yBackend = createYjsBackend({
        editor,
        project,
        path,
        initialValue: initialText,
        clientId: state.collab.uid,
        isMaster: state.collab.uid === 'master',
        getRTC: () => state.collab.rtc,
        bus: state.event?.bus,
      });
      editor.getWrapperElement?.().classList?.add?.('w-full', 'h-full');
      editor.getDoc?.().clearHistory?.();
      let changeHandler = async () => {
        if (!this.state.editorHandle?.editor) return;
        if (state.collab.uid !== 'master') return;
        await post('codeEditor.change');
      };
      editor.on('change', changeHandler);
      this.state.changeHandler = changeHandler;
      editor.focus();
    },

    reset: async () => {
      if (this.state.editorHandle?.editor && this.state.changeHandler) {
        this.state.editorHandle.editor.off('change', this.state.changeHandler);
      }
      this.state.yBackend?.destroy?.();
      this.state.yBackend = null;
      this.state.editorHandle?.destroy?.();
      this.state.editorHandle = null;
      this.state.changeHandler = null;
      this.state.currentPath = null;
      this.state.currentProject = null;
      let wrapper = document.querySelector('#CodeEditor');
      if (wrapper) wrapper.innerHTML = '';
    },

    change: debounce(async () => {
      if (!this.state.editorHandle?.editor || !state.files.current) return;
      let type = mimeLookup(state.files.current);
      await rfiles.save(state.projects.current, state.files.current, new Blob([this.state.editorHandle.editor.getValue()], { type }));
    }, 200),
  };
}
