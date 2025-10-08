import rfiles from '../repos/rfiles.js';
import { debounce, isMedia } from '../other/util.js';

export default class CodeEditor {
  state = {
    target(path) { return (path && !isMedia(path) && !(/^components\/|pages\//.test(path) && path.endsWith('.html'))) },
  };

  actions = {
    init: () => {
      let { bus } = state.event;
      let script = d.el('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.23.4/ace.js' });
      script.onload = () => bus.emit('codeEditor:init:ready');
      script.onerror = err => bus.emit('codeEditor:script:error', { error: err });
      document.head.append(script);
    },

    change: debounce(async () => {
      let editor = this.state.ace;
      let { project, path } = this.state.current;
      let type = mimeLookup(path);
      let text = editor.session.getValue();
      await rfiles.save(project, path, new Blob([text], { type }));
    }, 200),
  };
}
