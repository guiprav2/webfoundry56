class RenameFileDialog {
  constructor(props) {
    this.props = props;
    this.value = props.initialValue;
  }
  
  get valid() {
    return !!this.value?.trim?.() &&
           !this.value.match(/[:\/]/) &&
           !this.value.endsWith('.jsx');
  }
  
  onKeyDown = ev => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    ev.target.closest('form').querySelector('[value="ok"]').click();
  };

  onSubmit = ev => {
    ev.preventDefault();
    this.root.returnDetail = this.value.trim();
    this.root.close(ev.submitter.value);
  };
}

export default RenameFileDialog;