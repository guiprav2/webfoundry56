import rfiles from '../repos/rfiles.js';
import { debounce, isMedia } from '../other/util.js';
import { lookup as mimeLookup } from 'https://esm.sh/mrmime';

export default class CodeEditor {
  state = {
    target(path) { return (path && !isMedia(path) && !(/^components\/|pages\//.test(path) && path.endsWith('.html'))) },
  };

  actions = {
    init: () => {
      let { bus } = state.event;
      document.head.append(d.el('style', `
        .ace_editor { background-color: #040609 !important }
        .ace_gutter { background-color: #060a0f !important }
        .ace_active-line { background-color: #0009 !important }
        .ace_gutter-active-line { background-color: #0009 !important }
      `));
      let script = d.el('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.23.4/ace.js' });
      script.onload = async () => {
        let last;
        bus.on('files:select:ready', async ({ project, path }) => {
          let type = mimeLookup(path);
          if (!type?.startsWith?.('text/') || type === 'text/html') return;
          if (last === path) return;
          last = path;
          d.updateSync();
          let wrapper = document.querySelector('#CodeEditor');
          wrapper.innerHTML = '';
          let el = d.el('div', { class: 'w-full h-full' });
          wrapper.append(el);
          let editor = this.state.ace = ace.edit(el);
          editor.setFontSize(state.settings.opt.codeFontSize || '16px');
          editor.setTheme(`ace/theme/${state.settings.opt.codeTheme || 'monokai'}`);
          let mode = { html: 'html', css: 'css', js: 'javascript', md: 'markdown' }[path.split('.').pop()];
          mode && editor.session.setMode(`ace/mode/${mode}`);
          editor.session.setTabSize(state.settings.opt.codeTabSize || 2);
          editor.session.setOption('useWorker', false);
          editor.session.setValue(await (await rfiles.load(project, path)).text());
          editor.session.on('change', async () => await post('codeEditor.change'));
          editor.focus();
        });
        bus.emit('codeEditor:init:ready');
      };
      script.onerror = err => bus.emit('codeEditor:script:error', { error: err });
      document.head.append(script);
    },

    change: debounce(async () => await rfiles.save(state.projects.current, state.files.current, new Blob([this.state.ace.session.getValue()], { type: mimeLookup(state.files.current) })), 200),
  };
}
