class CreateFileDialog {
  type = 'file';
  constructor(props) { this.props = props }
  onChangeType = ev => this.type = ev.target.value;
  get valid() { return !!this.value?.trim?.() && !this.value.match(/[:\/]/) && !this.value.endsWith('.jsx') }

  onKeyDown = ev => {
    if (ev.key !== 'Enter') { return }
    ev.preventDefault();
    ev.target.closest('form').querySelector('[value="ok"]').click();
  };

  onSubmit = ev => { ev.preventDefault(); this.root.returnDetail = [this.type.trim(), this.value]; this.root.close(ev.submitter.value) };
}

export default CreateFileDialog;