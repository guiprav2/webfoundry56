import EventEmitter from 'https://esm.sh/eventemitter2';

export default class Companion {
  state = { pollDelay: 2000, pollTimeout: null, rpcs: {} };

  actions = {
    init: async () => {
      state.event.bus.on('settings:option:done', async ({ k, v }) => {
        if (!k.startsWith('companion')) return;
        if (!v && this.state.client) {
          this.state.client.dispose();
          this.state.client = null;
        }
        await post('companion.poll');
      });
      await post('companion.poll');
    },

    // TODO: Replace with polling connection library
    poll: async () => {
      let next = () => {
        clearTimeout(this.state.pollTimeout);
        this.state.pollTimeout = setTimeout(() => post('companion.poll'), this.state.pollDelay);
      };
      if (!state.settings.opt.companion) return next();
      let client = createClient(state.settings.opt.companionKey);
      let ok = await new Promise(pres => {
        client.events.once('connected', () => pres(true));
        client.events.once('error', () => null); // prevent uncaught error
        setTimeout(() => pres(false), 2000);
      });
      if (!ok) { client.dispose(); return next() }
      if (this.state.client) return; // race
      this.state.client = client;
      client.events.on('message', async ev => await post('companion.message', ev));
      client.events.on('close', async () => {
        this.state.client = null;
        state.event.bus.emit('companion:disconnected');
        await post('companion.poll');
      });
      state.event.bus.emit('companion:connected');
    },

    send: data => {
      let { client } = this.state;
      if (client?.status !== 'connected') throw new Error(`Companion not connected`);
      client.send(data);
    },

    rpc: async (proc, data = {}) => {
      let req = { type: null, rpcid: null, ...data, type: `rpc:${proc}`, rpcid: crypto.randomUUID() };
      await post('companion.send', req);
      let p = Promise.withResolvers();
      this.state.rpcs[req.rpcid] = { pres: p.resolve, prej: p.reject };
      return await p.promise;
    },

    message: ev => {
      if (ev.type !== 'rpc:response') return state.event.bus.emit(`companion:${ev.type}`, ev);
      if (!this.state.rpcs[ev.rpcid]) throw new Error(`Unknown RPCID: ${ev.rpcid}`);
      let rpc = this.state.rpcs[ev.rpcid];
      delete this.state.rpcs[ev.rpcid];
      if (ev.error) return rpc.prej(new Error(ev.error));
      rpc.pres(ev.data);
    },

    copyKey: async ev => {
      await navigator.clipboard.writeText(state.settings.opt.companionKey);
      let label = ev.target.closest('button').children[1];
      label.classList.remove('hidden');
      clearTimeout(this.state.copyKeyTimeout);
      this.state.copyKeyTimeout = setTimeout(() => label.classList.add('hidden'), 2000);
    },
  };
};

function createClient(key, opt = {}) {
  opt.endpoint ??= 'ws://localhost:8845';
  opt.timeout ??= 5000;

  let ret = {
    events: new EventEmitter({ wildcard: true }),
    status: 'connecting',
  };

  let oemit = ret.events.emit;
  ret.events.emit = function (name, data) {
    try {
      return oemit.call(this, name, { event: null, ...(data || {}), event: name });
    } catch (err) {
      console.error(err);
    }
  };

  let ws = new WebSocket(opt.endpoint);
  ret.ws = ws;

  ret.send = data => ws.send(JSON.stringify(data));

  let handshakeTimeout = setTimeout(() => {
    if (ret.status !== 'connected') {
      ws.close();
      ret.events.emit('error', {
        error: new Error(`Handshake timeout after ${opt.timeout}ms`),
      });
    }
  }, opt.timeout);

  const clearHandshakeTimeout = () => {
    if (handshakeTimeout) {
      clearTimeout(handshakeTimeout);
      handshakeTimeout = null;
    }
  };

  ws.addEventListener('close', () => {
    clearHandshakeTimeout();
    ret.events.emit('close');
  });

  ws.addEventListener('message', ({ data }) => {
    try {
      data = JSON.parse(data);
    } catch {
      return ret.events.emit('error', {
        error: new Error('Received non-JSON or corrupted message'),
      });
    }

    if (data.type === 'handshake') {
      if (ret.status === 'connected') {
        return ret.events.emit('error', {
          error: new Error('Received unexpected handshake after connected'),
        });
      }

      if (data.status === 'error') {
        clearHandshakeTimeout();
        ws.close();
        return ret.events.emit('error', {
          error: new Error(`Companion handshake error: "${data.reason}"`),
        });
      }

      if (data.status === 'hello') {
        ret.status = 'handshake';
        if (data.agent !== 'webfoundry-companion') {
          clearHandshakeTimeout();
          ws.close();
          return ret.events.emit('error', {
            error: new Error(`Unexpected companion agent: "${data.agent}"`),
          });
        }
        ret.send({ type: 'handshake', key });
        return;
      }

      if (data.status === 'ok') {
        clearHandshakeTimeout();
        ret.status = 'connected';
        ws.addEventListener('error', ev => 
          ret.events.emit('error', { error: new Error(`WebSocket error`) }));
        ret.events.emit('connected');
        return;
      }
    }

    ret.events.emit('message', data);
  });

  ret.dispose = () => {
    clearHandshakeTimeout();
    ws?.close?.();
  };

  return ret;
}
