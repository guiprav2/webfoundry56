import * as Y from 'https://esm.sh/yjs@13.6.12?target=es2022';
import { CodemirrorBinding } from 'https://esm.sh/y-codemirror?target=es2022&deps=codemirror@5.65.16,yjs@13.6.12';

const TEXT_FIELD = 'codemirror';

export function createYjsBackend({
  editor,
  project,
  path,
  initialValue,
  clientId = 'master',
  isMaster = true,
  getRTC = () => null,
  bus = null,
} = {}) {
  if (!editor) throw new Error('createYjsBackend requires a CodeMirror editor instance');
  if (!project || !path) throw new Error('createYjsBackend requires project and path');

  let doc = new Y.Doc();
  let yText = doc.getText(TEXT_FIELD);
  let binding = new CodemirrorBinding(yText, editor);

  if (typeof initialValue === 'string') {
    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, initialValue);
    }, 'initial-load');
  }

  let provider = new SupabaseYProvider({
    doc,
    project,
    path,
    clientId,
    isMaster,
    getRTC,
    bus,
  });

  return {
    doc,
    binding,
    provider,
    destroy() {
      provider.destroy();
      binding.destroy?.();
      doc.destroy();
    },
  };
}

class SupabaseYProvider {
  constructor({ doc, project, path, clientId, isMaster, getRTC, bus }) {
    this.doc = doc;
    this.project = project;
    this.path = path;
    this.clientId = clientId;
    this.isMaster = isMaster;
    this.getRTC = typeof getRTC === 'function' ? getRTC : () => getRTC ?? null;
    this.bus = bus;

    this.handleUpdate = this.handleUpdate.bind(this);
    this.handleRemoteUpdate = this.handleRemoteUpdate.bind(this);
    this.handleRequest = this.handleRequest.bind(this);
    this.handleBusEvent = this.handleBusEvent.bind(this);

    doc.on('update', this.handleUpdate);

    this.attachRTC(this.getRTC());

    if (this.bus?.on) {
      this.bus.on('wf:collab:setup:ready', this.handleBusEvent);
      this.bus.on('wf:collab:stop:ready', this.handleBusEvent);
      this.bus.on('collab:presence:update', this.handleBusEvent);
    }
  }

  handleBusEvent() {
    this.attachRTC(this.getRTC());
  }

  attachRTC(rtc) {
    if (this.rtc === rtc) return;
    this.detachRTC();
    this.rtc = rtc || null;
    if (!this.rtc) return;
    this.rtc.events.on('yjs:update', this.handleRemoteUpdate);
    if (this.isMaster) {
      this.rtc.events.on('yjs:request', this.handleRequest);
      this.broadcastFullState();
    } else {
      this.requestSync();
    }
  }

  detachRTC() {
    if (!this.rtc) return;
    this.rtc.events.off('yjs:update', this.handleRemoteUpdate);
    if (this.isMaster) {
      this.rtc.events.off('yjs:request', this.handleRequest);
    }
    this.rtc = null;
  }

  handleUpdate(update, origin) {
    if (!this.rtc || origin === 'remote') return;
    try {
      this.rtc.send({
        type: 'yjs:update',
        project: this.project,
        path: this.path,
        update: encodeUpdate(update),
      });
    } catch (err) {
      console.error('CodeEditor Yjs broadcast error', err);
    }
  }

  handleRemoteUpdate(message) {
    if (message.project !== this.project || message.path !== this.path) return;
    if (message.target && message.target !== this.clientId) return;
    if (message.peer && message.peer === this.clientId) return;
    if (!message.update) return;
    try {
      let update = decodeUpdate(message.update);
      Y.applyUpdate(this.doc, update, 'remote');
    } catch (err) {
      console.error('CodeEditor Yjs apply error', err);
    }
  }

  handleRequest(message) {
    if (!this.isMaster) return;
    if (message.project !== this.project || message.path !== this.path) return;
    if (!this.rtc) return;
    try {
      let update = Y.encodeStateAsUpdate(this.doc);
      this.rtc.send({
        type: 'yjs:update',
        project: this.project,
        path: this.path,
        update: encodeUpdate(update),
        target: message.peer || null,
      });
    } catch (err) {
      console.error('CodeEditor Yjs request error', err);
    }
  }

  requestSync() {
    if (!this.rtc) return;
    try {
      this.rtc.send({
        type: 'yjs:request',
        project: this.project,
        path: this.path,
      });
    } catch (err) {
      console.error('CodeEditor Yjs request broadcast error', err);
    }
  }

  broadcastFullState() {
    if (!this.rtc) return;
    try {
      let update = Y.encodeStateAsUpdate(this.doc);
      this.rtc.send({
        type: 'yjs:update',
        project: this.project,
        path: this.path,
        update: encodeUpdate(update),
      });
    } catch (err) {
      console.error('CodeEditor Yjs full broadcast error', err);
    }
  }

  destroy() {
    this.doc.off('update', this.handleUpdate);
    this.detachRTC();
    if (this.bus?.off) {
      this.bus.off('wf:collab:setup:ready', this.handleBusEvent);
      this.bus.off('wf:collab:stop:ready', this.handleBusEvent);
      this.bus.off('collab:presence:update', this.handleBusEvent);
    }
  }
}

function encodeUpdate(update) {
  let str = '';
  for (let i = 0; i < update.length; i++) {
    str += String.fromCharCode(update[i]);
  }
  return btoa(str);
}

function decodeUpdate(str) {
  let binary = atob(str);
  let arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

export default {
  createYjsBackend,
};
