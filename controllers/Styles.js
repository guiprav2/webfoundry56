export default class Styles {
  state = {
    get list() {
      let ss = state.designer.current.cursors?.master || [];
      let ssclasses = ss?.map?.(x => [...(state.designer.current.map.get(x)?.classList || [])]) || [];
      let classes;
      for (let ssc of ssclasses) classes = classes ? classes.intersection(new Set(ssc)) : new Set(ssc);
      classes = [...classes || []];
      let fws = 'tw:bs:bu'.split(':');
      return [...fws.filter(x => classes.includes(x)), ...classes.filter(x => !fws.includes(x))];
    },
  };

  actions = {
    init: () => {
      state.event.bus.on('designer:open:ready', () => this.state.replacing = null);
    },

    addKeyUp: async ev => {
      if (ev.key !== 'Enter') return;
      await post('styles.add', ev.target.value);
      ev.target.value = '';
    },

    add: async cls => {
      let frame = state.designer.current;
      cls = new Set(Array.isArray(cls) ? cls : cls.split(/\s+/));
      let targets = frame.cursors.master.map(x => frame.map.get(x)).filter(Boolean);
      await post('designer.pushHistory', 'master', async apply => {
        if (apply) for (let x of targets) for (let y of cls) x.classList.add(y);
        else for (let x of targets) for (let y of cls) x.classList.remove(y);
      });
    },

    edit: x => (this.state.replacing = x),
    replaceKeyDown: ev => ev.key === 'Enter' && ev.target.blur(),

    replaceBlur: async ev => {
      await post('styles.rm', this.state.replacing);
      await post('styles.add', ev.target.value.trim());
      this.state.replacing = null;
      ev.target.value = '';
    },

    rm: async cls => {
      let frame = state.designer.current;
      let classes = new Set(Array.isArray(cls) ? cls : cls.split(/\s+/));
      let targets = frame.cursors.master.map(x => frame.map.get(x)).filter(Boolean);
      await post('designer.pushHistory', 'master', async apply => {
        if (apply) for (let x of targets) for (let y of classes) x.classList.remove(y);
        else for (let x of targets) for (let y of classes) x.classList.add(y);
      });
    },
  };
}
