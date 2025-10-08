class NetlifyDeploy {
  constructor(props) {
    this.props = props;
    this.newSiteName = '';
    this.init();
  }

  async init() {
    try {
      const res = await fetch('https://api.netlify.com/api/v1/sites', {
        headers: { Authorization: `Bearer ${this.props.key}` }
      });
      if (!res.ok) throw new Error('Failed to fetch sites');
      this.sites = await res.json();
      this.selected = this.props.id || 'new';
    } catch (err) {
      console.error('Error loading Netlify sites:', err);
    } finally {
      d.update();
    }
  }

  get valid() {
    return this.selected || this.newSiteName.trim();
  }

  onKeyDown = ev => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    ev.target.closest('form').querySelector('[value="ok"]').click();
  };

  onSubmit = ev => {
    ev.preventDefault();
    this.root.returnDetail = this.selected !== 'new'
      ? ['existing', this.selected]
      : ['new', this.newSiteName.trim()];
    this.root.close(ev.submitter.value);
  };
}

export default NetlifyDeploy;