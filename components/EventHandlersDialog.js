class EventHandlersDialog {
  handlers = [{}];
  constructor(props) { this.props = props; this.handlers = [...this.props.handlers, {}] }

  clearEmpty = () => {
    this.handlers.push({});
    let i;
    for (i = 0; i < this.handlers.length; i++) {
      if (!this.handlers[i].name && !this.handlers[i].expr) { break }
    }
    let spliced = this.handlers.splice(i + 1, 99999);
    d.update();
  };

  onKeyUp = () => this.clearEmpty();

  onKeyDown = ev => {
    if (ev.key !== 'Enter') { return }
    ev.preventDefault();
    ev.target.closest('form').querySelector('[value="ok"]').click();
  };

  onSubmit = ev => { ev.preventDefault(); this.clearEmpty(); this.root.returnDetail = this.handlers.slice(0, -1); this.root.close(ev.submitter.value) };
}

export default EventHandlersDialog;
