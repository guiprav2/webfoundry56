import * as pako from 'https://esm.sh/pako';
import RealtimeCollab from '../other/RealtimeCollab.js';
import actions from '../other/actions.js';
import diff from 'https://esm.sh/fast-diff';
import morphdom from 'https://esm.sh/morphdom';
import rfiles from '../repos/rfiles.js';

export default class Collab {
  state = {
    get uid() { return location.pathname !== '/collab.html' ? 'master' : this.rtc?.uid },
    ver: 0,
    rpcs: {},
  };

  actions = {
    init: async () => {
      let { bus } = state.event;
      if (this.state.uid === 'master') {
        bus.on('projects:select:ready', async () => await post('collab.sync'));
        bus.on('files:select:ready', async () => await post('collab.sync'));
        bus.on('files:load:ready', async () => await post('collab.sync'));
        bus.on('designer:select:ready', async () => await post('collab.sync', 'full'));
        bus.on('designer:changeSelection:ready', async () => await post('collab.sync'));
        bus.on('designer:save:ready', async () => await post('collab.sync', 'delta'));
        bus.on('designer:resize:ready', async () => await post('collab.sync'));
        bus.on('designer:togglePreview:ready', async ({ preview }) => await post('collab.sync', !preview && 'full'));
      } else {
        let room = location.hash.slice(1);
        if (!room) { location.href = '/'; return }
        this.state.rtc = new RealtimeCollab(room);
        this.state.rtc.events.on('sync', async ev => await post('collab.apply', ev));
        this.state.rtc.events.on('rpc:response', async ev => await post('collab.rpcResponse', ev));
        this.state.rtc.events.on('presence:leave', async () => await post('collab.leave'));
        bus.on('designer:resize:ready', async () => await post('collab.resizeSync'));
      }
    },

    setup: async () => {
      let [btn, rtc] = await showModal('Collaborate');
      if (btn !== 'ok') return await rtc.teardown();
      this.state.rtc = rtc;
      rtc.events.on('presence:join', async () => await post('collab.sync', 'full'));
      rtc.events.on('presence:leave', async () => await post('collab.leave'));
      rtc.events.on('rpc:*', async ev => await post('collab.rpcInvoke', ev));
      rtc.events.on('changeSelection', async ev => await post('designer.changeSelection', ev.peer, ev.s.map(x => state.designer.current.map.get(x))));
      rtc.events.on('resize', async ev => { state.designer.frameWidth = ev.frameWidth; state.designer.frameHeight = ev.frameHeight; d.update() });
      rtc.events.on('cmd', async ev => await actions[ev.k].handler({ cur: null, ...ev, cur: ev.peer }));
      rtc.events.on('teardown', async () => await post('collab.leave'));
      await post('collab.sync', 'full');
    },

    stop: () => {
      this.state.rtc.teardown();
      this.state.rtc = null;
    },

    rpc: async (proc, data = {}) => {
      let req = { type: null, rpcid: null, ...data, type: `rpc:${proc}`, rpcid: crypto.randomUUID() };
      this.state.rtc.send(req);
      let p = Promise.withResolvers();
      this.state.rpcs[req.rpcid] = { pres: p.resolve, prej: p.reject };
      return await p.promise;
    },

    rpcResponse: async ev => {
      if (ev.peer !== 'master') throw new Error(`RPC response spoof (not from master)`);
      if (!this.state.rpcs[ev.rpcid]) throw new Error(`Unknown RPCID: ${ev.rpcid}`);
      let rpc = this.state.rpcs[ev.rpcid];
      delete this.state.rpcs[ev.rpcid];
      if (ev.error) return rpc.prej(new Error(ev.error));
      rpc.pres(ev.data);
    },

    rpcInvoke: async ev => {
      try {
        let proc = ev.type.split(':')[1];
        let fn = this.rpcs[proc];
        if (!fn) throw new Error(`Unknown RPC: ${proc}`);
        this.state.rtc.send({ type: 'rpc:response', rpcid: ev.rpcid, data: await fn(ev) });
      } catch (err) {
        console.error(err);
        this.state.rtc.send({ type: 'rpc:response', rpcid: ev.rpcid, error: err.toString() });
      }
    },

    sync: async kind => {
      this.state.ver++;
      let snap = state.designer.open ? state.designer.current.snap : '';
      let delta;
      if (kind === 'delta' && this.state.lastSnap) {
        let diffs = diff(this.state.lastSnap, snap);
        delta = await gzbase64(JSON.stringify(diffs));
      }
      this.state.lastSnap = snap;
      this.state.rtc?.send?.({
        type: 'sync',
        ver: this.state.ver,
        project: state.projects.current,
        files: state.files.list,
        expandedPaths: [...state.files.expandedPaths],
        current: state.files.current,
        frameWidth: state.designer.frameWidth,
        frameHeight: state.designer.frameHeight,
        preview: state.designer.current?.preview,
        contents: kind === 'full' ? snap : undefined,
        delta,
        cursors: state.designer.current?.cursors || {},
        clipboards: state.designer.clipboards,
      });
    },

    resizeSync: async () => this.state.rtc?.send?.({ type: 'resize', frameWidth: state.designer.frameWidth, frameHeight: state.designer.frameHeight }),

    apply: async ev => {
      if (ev.ver <= this.state.ver) return;
      this.state.ver = ev.ver;
      state.projects.current = ev.project;
      state.files.list = ev.files;
      state.files.expandedPaths = new Set(ev.expandedPaths);
      if (state.files.current !== ev.current) {
        state.files.current = ev.current;
        await post('designer.select', ev.current);
      }
      state.designer.frameWidth = ev.frameWidth;
      state.designer.frameHeight = ev.frameHeight;
      if (state.designer.open && state.designer.current.preview !== ev.preview) await post('designer.togglePreview');
      if (ev.contents) {
        morphdom(state.designer.current.html, ev.contents);
        this.state.lastSnap = ev.contents;
      } else if (ev.delta) {
        let diffs = JSON.parse(await ungzbase64(ev.delta));
        let patched = applyFastDiff(this.state.lastSnap, diffs);
        morphdom(state.designer.current.html, patched);
        this.state.lastSnap = patched;
      }
      if (state.designer.open) state.designer.current.cursors = ev.cursors;
      state.designer.clipboards = ev.clipboards;
    },

    leave: async () => {
      if (this.state.uid !== 'master' && !state.collab.rtc.presence.some(x => x.user === 'master')) state.files.current = null;
      if (!state.designer.open) return;
      for (let k of Object.keys(state.designer.current.cursors)) {
        if (this.state.uid !== k && !this.state.rtc?.presence?.find?.(x => x.user === k)) {
          let ovs = state.designer.current.overlays[k];
          for (let x of ovs) x.disable();
          delete state.designer.current.overlays[k];
          delete state.designer.current.cursors[k];
        }
      }
      this.state.uid === 'master' && await post('collab.sync');
    },
  };

  rpcs = {
    list: async ({ project }) => {
      if (state.projects.current !== project) throw new Error(`Wrong project: ${project}`);
      return await rfiles.list(project);
    },

    fetch: async ({ project, path }) => {
      if (state.projects.current !== project) throw new Error(`Wrong project: ${project}`);
      let blob = await rfiles.load(project, path);
      if (!blob) throw new Error(`Not found: ${path}`);
      return await b64(await gzblob(blob));
    },

    save: async ({ project, path, data }) => {
      if (state.projects.current !== project) throw new Error(`Wrong project: ${project}`);
      await rfiles.save(project, path, await ungzblob(await unb64(data)));
    },
  };
}

function applyFastDiff(oldText, diffs) {
  let out = '';
  for (let [op, data] of diffs) {
    if (op === 0) out += data;
    else if (op === 1) out += data;
  }
  return out;
}

async function gzbase64(str) {
  let blob = new Blob([pako.gzip(str)], { type: 'application/gzip' });
  return await b64(blob);
}

async function ungzbase64(b64str) {
  let binary = atob(b64str);
  let array = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(pako.ungzip(array));
}

async function gzblob(blob) {
  return new Blob([pako.gzip(new Uint8Array(await blob.arrayBuffer()))], { type: 'application/gzip' });
}

async function ungzblob(blob, type) {
  if (blob == null) return null;
  return new Blob([pako.ungzip(new Uint8Array(await blob.arrayBuffer()))], { type });
}

function b64(blob) {
  return new Promise((res, rej) => {
    let r = new FileReader();
    r.onloadend = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function unb64(base64, type = '') {
  if (base64 == null) return null;
  let chars = atob(base64);
  let nums = new Array(chars.length);
  for (let i = 0; i < chars.length; i++) nums[i] = chars.charCodeAt(i);
  return new Blob([new Uint8Array(nums)], { type });
}
