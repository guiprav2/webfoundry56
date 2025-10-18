import { FitAddon } from 'https://esm.sh/xterm-addon-fit';
import { Terminal } from 'https://esm.sh/xterm';

export default class Shell {
  state = { list: [] };

  actions = {
    init: () => {
      let { bus } = state.event;
      document.head.append(d.el('link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/xterm/css/xterm.css' }));
      document.head.append(d.el('style', `.xterm-selection { display: none }`));
      document.body.classList.add('w-screen', 'overflow-hidden');
      if (state.collab.uid !== 'master') return;
      bus.on('shell:toggle:ready', async ({ open }) => {
        if (!open || this.state.list.length) return;
        await post('shell.spawn');
      });
      bus.on('companion:shell:close', async ({ session }) => await post('shell.close', session, true));
      bus.on('companion:shell', async data => await post('shell.message', data));
    },

    toggle: async x => {
      x ??= !this.state.open;
      state.event.bus.emit('shell:toggle:start', { open: x });
      this.state.open = x;
      state.event.bus.emit('shell:toggle:ready', { open: x });
    },

    spawn: async () => {
      if (state.companion.client.status !== 'connected') throw new Error(`Companion not connected`);
      await loadman.run('shell.spawn', async () => {
        let { bus } = state.event;
        bus.emit('shell:spawn:start');
        let [name, uuid] = state.projects.current?.split?.(':') || [];
        let tab = {
          project: state.projects.current,
          term: new Terminal({ cursorBlink: true, fontFamily: 'monospace', fontSize: 14, theme: { background: '#00000000', foreground: '#ffffff' } }),
          msgbuf: [],
        };
        tab.autofit = new FitAddon();
        tab.term.loadAddon(tab.autofit);
        tab.session = await post('companion.rpc', 'shell:spawn', { subdir: name, cols: tab.term.cols, rows: tab.term.rows });
        tab.term.onData(async x => state.collab.uid === 'master' && await post('companion.send', { type: 'shell', session: tab.session, payload: b64(x) }));
        this.state.list.push(tab);
        this.state.current = tab.session;
        bus.emit('shell:spawn:ready', { tab });
      }, true);
    },

    attach: (session, wrapper) => requestAnimationFrame(() => {
      let { bus } = state.event;
      let tab = this.state.list.find(x => x.session === session);
      bus.emit('shell:attach:start', { tab });
      tab.term.open(wrapper);
      if (state.collab.uid === 'master') {
        tab.autofit.fit();
        tab.resizeObserver = new ResizeObserver(async () => {
          tab.autofit.fit();
          await post('companion.rpc', 'shell:resize', { session, cols: tab.term.cols, rows: tab.term.rows });
        });
        tab.resizeObserver.observe(wrapper);
      }
      state.event.bus.emit('shell:attach:ready', { tab });
    }),

    message: async ({ session, ...data }) => {
      let tab = this.state.list.find(x => x.session === session);
      if (!tab) return; // pinball
      switch (data.subtype) {
        case 'label': tab.label = data.label; state.event.bus.emit('shell:message:label', { session: tab.session, label: tab.label }); break;
        case 'stream':
          state.event.bus.emit('shell:message:stream', { session: tab.session, payload: data.payload });
          tab.msgbuf.push(data.payload);
          tab.term.write(unb64(data.payload));
          break;
        default: throw new Error(`Unknown shell message subtype: ${data.subtype}`);
      }
    },

    select: session => {
      let { bus } = state.event;
      let tab = this.state.list.find(x => x.session === session);
      if (session && !tab) throw new Error(`Unknown terminal session: ${session}`);
      bus.emit('shell:select:start', { tab });
      this.state.current = session;
      bus.emit('shell:select:ready', { tab });
    },

    close: async (session, remote) => {
      let { bus } = state.event;
      let tab = this.state.list.find(x => x.session === session);
      if (!tab) return; // pinball
      bus.emit('shell:close:start', { tab });
      !remote && await post('companion.rpc', 'shell:kill', { session });
      tab.resizeObserver.disconnect();
      tab.term.dispose();
      let i = this.state.list.findIndex(x => x.session === session);
      i >= 0 && this.state.list.splice(i, 1);
      if (this.state.current === session) await post('shell.select', this.state.list[i]?.session || this.state.list[i - 1]?.session);
      if (!this.state.list.length && this.state.open) await post('shell.toggle');
      state.event.bus.emit('shell:close:ready', { tab });
    },
  };
};

let b64 = str => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
let unb64 = str => new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)));
