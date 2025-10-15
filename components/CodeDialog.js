import prettier from '../other/prettier.js';
import { mountCodeMirror } from '../other/codemirror.js';

class CodeDialog {
  constructor(props) {
    this.props = props;
  }

  onAttach = async () => {
    if (!document.getElementById('CodeEditorStyles')) {
      document.head.append(d.el('style', { id: 'CodeEditorStyles' }, `
        .CodeMirror { background-color: #04060960 !important; height: 100%; }
        .CodeMirror-gutters { background-color: #060a0f60 !important; }
        .CodeMirror-activeline-background { background-color: #0009 !important; }
        .CodeMirror-activeline .CodeMirror-gutter-elt { background-color: #0009 !important; }
      `));
    }
    let wrapper = this.root.querySelector('.CodeDialog-editorWrapper');
    let el = d.el('div', { class: 'flex flex-col flex-1' });
    wrapper.innerHTML = '';
    wrapper.append(el);
    let value = this.props.initialValue;
    if (value && (!this.props.mode || this.props.mode === 'html')) {
      value = await prettier(value, { parser: this.props.mode || 'html' });
    }
    let settings = state?.settings?.opt || {};
    let { editor, destroy, setKeyMap, setTheme, setMode } = await mountCodeMirror(el, {
      mode: this.props.mode || 'html',
      theme: settings.codeTheme || 'monokai',
      keyMap: settings.vim ? 'vim' : 'default',
      tabSize: settings.codeTabSize || 2,
      fontSize: settings.codeFontSize || '16px',
      lineWrapping: false,
    });
    this.editorHandle = { editor, destroy, setKeyMap, setTheme, setMode };
    editor.setValue(value || '');
    editor.getDoc?.().clearHistory?.();
    editor.getWrapperElement?.().classList?.add?.('flex-1');
    editor.focus();
    this.root.addEventListener('close', () => {
      this.editorHandle?.destroy?.();
      this.editorHandle = null;
    }, { once: true });
  };

  onSubmit = async ev => {
    ev.preventDefault();
    let value = this.editorHandle?.editor.getValue();
    if (value && (!this.props.mode || this.props.mode === 'html')) {
      value = await prettier(value, { parser: this.props.mode || 'html' });
    }
    this.root.returnDetail = value;
    this.root.close(ev.submitter.value);
  };
}

export default CodeDialog;
