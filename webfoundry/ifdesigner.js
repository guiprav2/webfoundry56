import BiMap from './bimap.js';
import htmlsnap from 'https://esm.sh/@camilaprav/htmlsnap@0.0.13';

let state = { map: new BiMap(), cursors: {} };
let wforigin = `${location.protocol}//${location.hostname.split('.').slice(1).join('.')}`;
addEventListener('message', async ev => {
  let { type, ...rest } = ev.data;
  if (type !== 'state' || ev.origin !== wforigin) return;
  Object.assign(state, rest);
});
addEventListener('message', async ev => {
  if (ev.data.type !== 'eval' || ev.origin !== wforigin) return;
  try {
    let AsyncFunction = (async () {}).constructor;
    let fn = new AsyncFunction(ev.data.fn, 'state', 'args');
    parent.postMessage({ type: 'eval:res', rpcid: ev.data.rpcid, result: await fn(state, ev.data) }, wforigin);
  } catch (err) {
    console.error(err);
    parent.postMessage({ type: 'eval:res', rpcid: ev.data.rpcid, error: err.toString() }, wforigin);
  }
});
addEventListener('mousedown', async ev => {
  document.activeElement.blur();
  ev.preventDefault();
  if (!ev.shiftKey) await actions.changeSelection.handler({ cur: state.collab.uid, s: [state.map.getKey(ev.target)] });
  else await actions.changeSelection.handler({ cur: state.collab.uid, s: [...new Set([...state.cursors[state.collab.uid] || [], state.map.getKey(ev.target)])] });
});
let snap = () => parent.postMessage({ type: 'htmlsnap', snap: htmlsnap(document.documentElement, { idtrack: true, map: state.map })[0] }, wforigin);
let mutobs = new MutationObserver(snap);
mutobs.observe(document, { attributes: true, subtree: true, childList: true, characterData: true });
snap();
