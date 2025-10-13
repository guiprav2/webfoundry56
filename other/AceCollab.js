import { debounce } from '../other/util.js';
import {
  applyOperation,
  composeOperations,
  transformOperations,
  isEmptyOperation,
  cloneOperation,
  normalizeOperation,
  deleteLength,
} from './textOt.js';

const TailwindHex = {
  'red-600': '#dc2626',
  'red-800': '#991b1b',
  'orange-600': '#ea580c',
  'orange-800': '#9a3412',
  'amber-600': '#d97706',
  'amber-800': '#92400e',
  'yellow-600': '#ca8a04',
  'yellow-800': '#854d0e',
  'lime-600': '#65a30d',
  'lime-800': '#3f6212',
  'green-600': '#16a34a',
  'green-800': '#166534',
  'emerald-600': '#059669',
  'emerald-800': '#065f46',
  'teal-600': '#0d9488',
  'teal-800': '#115e59',
  'cyan-600': '#0891b2',
  'cyan-800': '#155e75',
  'sky-600': '#0284c7',
  'sky-800': '#075985',
  'blue-600': '#2563eb',
  'blue-800': '#1d4ed8',
  'indigo-600': '#4f46e5',
  'indigo-800': '#3730a3',
  'violet-600': '#7c3aed',
  'violet-800': '#5b21b6',
  'purple-600': '#9333ea',
  'purple-800': '#6b21a8',
  'fuchsia-600': '#c026d3',
  'fuchsia-800': '#86198f',
  'pink-600': '#db2777',
  'pink-800': '#9d174d',
  'rose-600': '#e11d48',
  'rose-800': '#9f1239',
};

const colorClassCache = new Map();
let styleEl;

function ensureStyleSheet() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'ace-collab-styles';
    styleEl.textContent = `
      .ace_editor .remote-selection { position: absolute; opacity: 0.35; }
      .ace_editor .remote-caret { position: absolute; width: 2px; }
    `;
    document.head.append(styleEl);
  }
  return styleEl.sheet;
}

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(99, 102, 241, ${alpha})`;
  let value = hex.replace('#', '');
  if (value.length === 3) value = value.split('').map(x => x + x).join('');
  let bigint = parseInt(value, 16);
  let r = (bigint >> 16) & 255;
  let g = (bigint >> 8) & 255;
  let b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ensureColorClasses(colorName) {
  if (!colorName) colorName = 'indigo-600';
  if (colorClassCache.has(colorName)) return colorClassCache.get(colorName);
  let hex = TailwindHex[colorName] || TailwindHex['indigo-600'];
  let selection = hexToRgba(hex, 0.25);
  let caret = hexToRgba(hex, 0.9);
  let className = `remote-${colorName.replace(/[^a-z0-9]+/gi, '-')}`;
  let sheet = ensureStyleSheet();
  try {
    sheet.insertRule(`.ace_editor .remote-selection.${className} { background: ${selection}; }`, sheet.cssRules.length);
    sheet.insertRule(`.ace_editor .remote-caret.${className} { background: ${caret}; }`, sheet.cssRules.length);
  } catch (err) {
    console.error(err);
  }
  let classes = {
    selection: `remote-selection ${className}`,
    caret: `remote-caret ${className}`,
  };
  colorClassCache.set(colorName, classes);
  return classes;
}

function positionToIndex(snapshot, row, column) {
  row = Math.max(0, row);
  column = Math.max(0, column);
  let index = 0;
  let lines = snapshot.split('\n');
  for (let i = 0; i < row && i < lines.length; i++) index += lines[i].length + 1;
  if (row >= lines.length) return snapshot.length;
  let line = lines[row] ?? '';
  index += Math.min(column, line.length);
  return index;
}

function deltaToOperation(snapshot, delta, rowAdjust = 0) {
  if (!delta) return [];
  let row = (delta.start?.row ?? 0) + rowAdjust;
  let column = delta.start?.column ?? 0;
  let startIndex = positionToIndex(snapshot, row, column);
  let op = [];
  if (startIndex > 0) op.push(startIndex);
  let text = Array.isArray(delta.lines) ? delta.lines.join('\n') : '';
  if (delta.action === 'insert') {
    if (text.length) op.push(text);
  } else if (delta.action === 'remove') {
    if (text.length) op.push({ d: text });
  } else {
    return [];
  }
  return normalizeOperation(op);
}

class RemoteCaretMarker {
  constructor(className) {
    let Range = ace.require('ace/range').Range;
    this.range = new Range(0, 0, 0, 0);
    this.className = className;
  }

  setPosition(row, column) {
    this.range.start.row = row;
    this.range.start.column = column;
    this.range.end.row = row;
    this.range.end.column = column;
  }

  update(html, markerLayer, session, config) {
    let screenPos = session.documentToScreenPosition(this.range.start.row, this.range.start.column);
    let top = markerLayer.$padding + screenPos.row * config.lineHeight;
    let left = markerLayer.$padding + screenPos.column * config.characterWidth;
    let height = config.lineHeight;
    html.push(`<div class="${this.className}" style="left:${left}px;top:${top}px;height:${height}px"></div>`);
  }
}

export default class AceCollabBinding {
  constructor({ editor, path, project }) {
    this.editor = editor;
    this.session = editor.session;
    this.path = path;
    this.project = project;
    this.bus = state.event?.bus;
    this.clientId = state.collab?.rtc?.uid || state.collab?.uid || 'master';
    this.version = state.collab?.codeVersions?.get?.(path) ?? 0;
    this.doc = this.session.getValue();
    this.buffer = null;
    this.outstanding = [];
    this.applyingRemote = false;
    this.disposed = false;
    this.remoteCursors = new Map();
    this.lastCursorPayload = null;

    state.collab?.codeVersions?.set?.(path, this.version);

    this.changeHandler = this.handleChange.bind(this);
    this.remoteOpHandler = this.handleRemoteOp.bind(this);
    this.remoteCursorHandler = this.handleRemoteCursor.bind(this);
    this.cursorChangeHandler = this.handleCursorChange.bind(this);
    this.presenceHandler = this.handlePresenceUpdate.bind(this);
    this.cursorTicker = debounce(() => this.broadcastCursor(), 60);

    this.session.on('change', this.changeHandler);
    this.editor.selection.on('changeCursor', this.cursorChangeHandler);
    this.editor.selection.on('changeSelection', this.cursorChangeHandler);
    this.bus?.on('collab:code:op', this.remoteOpHandler);
    this.bus?.on('collab:code:cursor', this.remoteCursorHandler);
    this.bus?.on('collab:presence:update', this.presenceHandler);
    this.bus?.on('collab:leave', this.presenceHandler);

    this.broadcastCursor();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.session.off?.('change', this.changeHandler);
    this.session.removeListener?.('change', this.changeHandler);
    this.editor.selection.off?.('changeCursor', this.cursorChangeHandler);
    this.editor.selection.off?.('changeSelection', this.cursorChangeHandler);
    this.bus?.off?.('collab:code:op', this.remoteOpHandler);
    this.bus?.off?.('collab:code:cursor', this.remoteCursorHandler);
    this.bus?.off?.('collab:presence:update', this.presenceHandler);
    this.bus?.off?.('collab:leave', this.presenceHandler);
    for (let entry of this.remoteCursors.values()) this.removeRemoteCursor(entry);
    this.remoteCursors.clear();
  }

  isApplyingRemote() {
    return this.applyingRemote;
  }

  handleChange(delta) {
    if (this.disposed || this.applyingRemote) return;
    let op = deltaToOperation(this.doc, delta);
    if (!op.length || isEmptyOperation(op)) {
      this.doc = this.session.getValue();
      return;
    }
    this.doc = this.session.getValue();
    this.buffer = this.buffer ? composeOperations(this.buffer, op) : op;
    this.buffer = normalizeOperation(this.buffer);
    this.flush();
  }

  flush() {
    if (this.disposed || !this.buffer || !this.buffer.length) return;
    let op = normalizeOperation(cloneOperation(this.buffer));
    this.buffer = null;
    let base = this.version;
    let version = base + 1;
    let outstanding = { op: normalizeOperation(cloneOperation(op)), base, version };
    this.outstanding.push(outstanding);
    this.version = Math.max(this.version, version);
    state.collab?.codeVersions?.set?.(this.path, version);
    post('collab.codeBroadcast', {
      path: this.path,
      project: this.project,
      base,
      version,
      ops: op,
      value: this.doc,
      author: this.clientId,
    });
  }

  handleRemoteOp(ev) {
    if (this.disposed) return;
    if (!ev || ev.path !== this.path) return;
    if (ev.project && ev.project !== this.project) return;

    let incomingVersion = ev.version ?? (ev.base != null ? ev.base + 1 : null);
    if (incomingVersion != null) {
      this.version = Math.max(this.version, incomingVersion);
      state.collab?.codeVersions?.set?.(this.path, incomingVersion);
    }

    if (ev.peer === this.clientId) {
      let idx = this.outstanding.findIndex(entry => entry.version === incomingVersion || entry.base === ev.base);
      if (idx >= 0) this.outstanding.splice(idx, 1);
      this.flush();
      return;
    }

    let remoteOp = Array.isArray(ev.ops) ? normalizeOperation(ev.ops.slice()) : [];

    if (!remoteOp.length) {
      if (typeof ev.value === 'string') this.resetTo(ev.value);
      return;
    }

    try {
      for (let entry of this.outstanding) {
        let [localPrime, remotePrime] = transformOperations(entry.op, remoteOp);
        entry.op = normalizeOperation(localPrime);
        remoteOp = normalizeOperation(remotePrime);
      }

      if (this.buffer) {
        let [bufferPrime, remotePrime] = transformOperations(this.buffer, remoteOp);
        this.buffer = normalizeOperation(bufferPrime);
        remoteOp = normalizeOperation(remotePrime);
      }

      let oldDoc = this.doc;
      let newDoc = applyOperation(oldDoc, remoteOp);
      if (typeof ev.value === 'string' && newDoc !== ev.value) {
        this.resetTo(ev.value);
        return;
      }
      this.doc = newDoc;
      this.applyToSession(remoteOp);
    } catch (err) {
      console.error('AceCollab remote apply error', err);
      if (typeof ev.value === 'string') this.resetTo(ev.value);
      else this.resetTo(this.doc);
    }
  }

  applyToSession(op) {
    this.applyingRemote = true;
    let doc = this.session.getDocument();
    let Range = ace.require('ace/range').Range;
    let index = 0;
    for (let component of op) {
      if (typeof component === 'number') {
        index += component;
      } else if (typeof component === 'string') {
        let pos = doc.indexToPosition(index, 0);
        doc.insert(pos, component);
        index += component.length;
      } else if (component && component.d != null) {
        let len = deleteLength(component);
        let start = doc.indexToPosition(index, 0);
        let end = doc.indexToPosition(index + len, 0);
        doc.remove(new Range(start.row, start.column, end.row, end.column));
      }
    }
    this.applyingRemote = false;
  }

  resetTo(value) {
    this.applyingRemote = true;
    this.session.setValue(value ?? '', -1);
    this.applyingRemote = false;
    this.doc = this.session.getValue();
    this.outstanding = [];
    this.buffer = null;
  }

  handleCursorChange() {
    if (this.disposed) return;
    this.cursorTicker();
  }

  broadcastCursor() {
    if (this.disposed) return;
    let sel = this.editor.getSelection();
    let range = sel.getRange();
    let payload = {
      path: this.path,
      project: this.project,
      cursor: {
        start: { row: range.start.row, column: range.start.column },
        end: { row: range.end.row, column: range.end.column },
        isEmpty: range.isEmpty(),
        ts: Date.now(),
      },
    };
    if (JSON.stringify(this.lastCursorPayload) === JSON.stringify(payload.cursor)) return;
    this.lastCursorPayload = payload.cursor;
    post('collab.codeCursorBroadcast', payload);
  }

  handleRemoteCursor(ev) {
    if (this.disposed) return;
    if (!ev || ev.path !== this.path) return;
    if (ev.project && ev.project !== this.project) return;
    if (ev.peer === this.clientId) return;
    let cursor = ev.cursor;
    if (!cursor) return;
    let presence = state.collab?.rtc?.presence || [];
    let peerInfo = presence.find(x => x.user === ev.peer) || {};
    let classes = ensureColorClasses(peerInfo.color);
    this.upsertRemoteCursor(ev.peer, cursor, classes);
  }

  handlePresenceUpdate() {
    if (this.disposed) return;
    let presence = state.collab?.rtc?.presence || [];
    let active = new Set(presence.map(x => x.user));
    for (let [peer, entry] of this.remoteCursors.entries()) {
      if (!active.has(peer)) {
        this.removeRemoteCursor(entry);
        this.remoteCursors.delete(peer);
      }
    }
  }

  upsertRemoteCursor(peer, cursor, classes) {
    let entry = this.remoteCursors.get(peer);
    let Range = ace.require('ace/range').Range;
    if (!entry) {
      let caretMarker = new RemoteCaretMarker(classes.caret);
      let caretId = this.session.addDynamicMarker(caretMarker, true);
      entry = {
        caretMarker,
        caretId,
        selectionId: null,
        classes,
      };
      this.remoteCursors.set(peer, entry);
    }
    entry.classes = classes;
    if (entry.selectionId != null) {
      this.session.removeMarker(entry.selectionId);
      entry.selectionId = null;
    }
    let caretMarker = entry.caretMarker;
    if (caretMarker instanceof RemoteCaretMarker) {
      caretMarker.className = classes.caret;
      caretMarker.setPosition(cursor.end.row, cursor.end.column);
    }
    if (!cursor.isEmpty) {
      let range = new Range(cursor.start.row, cursor.start.column, cursor.end.row, cursor.end.column);
      entry.selectionId = this.session.addMarker(range, classes.selection, 'text', false);
    }
  }

  removeRemoteCursor(entry) {
    if (!entry) return;
    if (entry.selectionId != null) this.session.removeMarker(entry.selectionId);
    if (entry.caretId != null) this.session.removeMarker(entry.caretId);
    entry.selectionId = null;
    entry.caretId = null;
    entry.caretMarker = null;
  }
}
