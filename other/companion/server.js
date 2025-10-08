import * as WebSocket from 'ws';
import EventEmitter from 'eventemitter2';

export default function server(key, opt = {}) {
  if (!key) throw new Error(`Missing key`);
  opt.port ??= 8845;

  let rpc = {};

  let ret = {
    events: new EventEmitter({ wildcard: true }),
    clients: new Set(),
    rpc: (name, fn) => rpc[name] = fn,
    broadcast: data => {
      for (let x of ret.clients) x.send(JSON.stringify(data));
    },
  };

  let wss = new WebSocket.WebSocketServer({ port: opt.port });
  ret.send = (ws, data) => ws.send(JSON.stringify(data)),

  wss.on('connection', (ws) => {
    ws.on('error', err => ret.events.emit('error', {
      ws,
      error: new Error(`WebSocket error: ${err.message}`),
    }));

    ws.on('close', () => {
      ret.clients.delete(ws);
      ret.events.emit('disconnected', { ws });
    });

    ret.send(ws, { type: 'handshake', status: 'hello', agent: 'webfoundry-companion' });

    ws.on('message', async msg => {
      let data;
      try {
        data = JSON.parse(msg);
      } catch {
        ret.events.emit('error', { ws, error: new Error(`Received invalid JSON`) });
        return ws.send(JSON.stringify({ type: 'error', error: 'Received invalid JSON' }));
      }
      if (data.type === 'handshake') {
        if (data.key === key) {
          ret.clients.add(ws);
          ws.send(JSON.stringify({ type: 'handshake', status: 'ok' }));
          ret.events.emit('connected', { ws });
        } else {
          ws.send(JSON.stringify({ type: 'handshake', status: 'error', reason: 'auth_fail' }));
          ws.close(1008, `Authentication failure`);
          ret.events.emit('error', { ws, error: new Error(`Client sent bad handshake key`) });
        }
        return;
      }
      let { type } = data;
      delete data.type;
      if (type.startsWith('rpc:')) {
        let { rpcid, ...params } = data;
        try {
          let proc = 'rpc:'.length;
          let fn = rpc[type.slice(proc)];
          if (!fn) throw new Error(`Unknown procedure: ${proc}`);
          ws.send(JSON.stringify({ type: 'rpc:response', rpcid, data: await fn({ ws: null, ...params, ws }) }));
        } catch (err) {
          console.error(err);
          ws.send(JSON.stringify({ type: 'rpc:response', rpcid, error: err.toString() }));
        }
      } else {
        ret.events.emit(`message:${type}`, { ws: null, ...data, ws });
      }
    });
  });

  ret.wss = wss;
  ret.dispose = () => ret.wss.close();
  return ret;
}
