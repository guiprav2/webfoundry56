import prettier from '../other/prettier.js';

class CodeDialog {
  constructor(props) {
    this.props = props;
  }

  onAttach = async () => {
    let wrapper = this.root.querySelector('.CodeDialog-editorWrapper');
    let el = d.el('div', { class: 'flex-1' });
    wrapper.innerHTML = '';
    wrapper.append(el);
    this.editor = ace.edit(el);
    this.editor.setTheme('ace/theme/monokai');
    this.editor.session.setMode(`ace/mode/${this.props.mode || 'html'}`);
    this.editor.session.setTabSize(2);
    let value = this.props.initialValue;
    if (value && (!this.props.mode || this.props.mode === 'html')) {
      value = await prettier(value, { parser: this.props.mode || 'html' });
    }
    value && this.editor.session.setValue(value);
    this.editor.focus();
  };

  onSubmit = async ev => {
    ev.preventDefault();
    let value = this.editor.session.getValue();
    if (value && (!this.props.mode || this.props.mode === 'html')) {
      value = await prettier(value, { parser: this.props.mode || 'html' });
    }
    this.root.returnDetail = value;
    this.root.close(ev.submitter.value);
  };
}

export default CodeDialog;
