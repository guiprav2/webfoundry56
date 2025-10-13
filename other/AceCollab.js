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

const DEFAULT_COLLAB_COLOR = 'indigo-600';
let styleEl;

function ensureStyleSheet() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'ace-collab-styles';
    styleEl.textContent = `
      @keyframes ace-collab-caret-blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
      .ace_editor .ace_text-input { caret-color: transparent }
      .ace_editor .ace-collab-overlays { position: absolute; inset: 0; pointer-events: none; z-index: 12 }
      .ace_editor .remote-selection { position: absolute; opacity: 0.35; pointer-events: none; border-radius: 2px }
      .ace_editor .remote-caret { position: absolute; width: 2px; min-width: 2px; pointer-events: none; opacity: 0.9; animation: ace-collab-caret-blink 1s step-end infinite; border-radius: 1px }
      .ace_editor .ace_selection { opacity: 0 !important }
      .ace_editor .ace_cursor { opacity: 0 !important }
    `;
    document.head.append(styleEl);
  }
}

function ensureColorClasses(colorName) {
  ensureStyleSheet();
  let token = (colorName && String(colorName).trim()) || DEFAULT_COLLAB_COLOR;
  token = token.split(/\s+/)[0];
  token = token.replace(/[^a-z0-9-\\/]/gi, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!token) token = DEFAULT_COLLAB_COLOR;
  let bgClass = token.startsWith('bg-') ? token : `bg-${token}`;
  return {
    selection: `remote-selection ${bgClass}`,
    caret: `remote-caret ${bgClass}`,
  };
}

function cloneCursor(cursor) {
  if (!cursor) return null;
  return {
    start: {
      row: cursor.start?.row ?? 0,
      column: cursor.start?.column ?? 0,
    },
    end: {
      row: cursor.end?.row ?? 0,
      column: cursor.end?.column ?? 0,
    },
    isEmpty: Boolean(cursor.isEmpty),
  };
}

function computeSelectionSegments(session, cursor) {
  if (!cursor || cursor.isEmpty) return [];
  let Range = ace.require('ace/range').Range;
  let docRange = Range.fromPoints(cursor.start, cursor.end);
  if (docRange.isEmpty()) return [];
  let screenRange = docRange.toScreenRange(session);
  let segments = [];
  let startRow = screenRange.start.row;
  let endRow = screenRange.end.row;
  for (let row = startRow; row <= endRow; row++) {
    let startColumn = row === startRow ? screenRange.start.column : 0;
    let endColumn;
    if (row === endRow) {
      endColumn = screenRange.end.column;
    } else {
      let rowEndDoc = session.screenToDocumentPosition(row, Number.POSITIVE_INFINITY);
      let rowEndScreen = session.documentToScreenPosition(rowEndDoc.row, rowEndDoc.column);
      endColumn = rowEndScreen.column;
    }
    if (typeof endColumn !== 'number' || typeof startColumn !== 'number') continue;
    segments.push({ row, startColumn, endColumn });
  }
  return segments;
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
    this.overlayRoot = null;

    state.collab?.codeVersions?.set?.(path, this.version);

    this.changeHandler = this.handleChange.bind(this);
    this.remoteOpHandler = this.handleRemoteOp.bind(this);
    this.remoteCursorHandler = this.handleRemoteCursor.bind(this);
    this.cursorChangeHandler = this.handleCursorChange.bind(this);
    this.presenceHandler = this.handlePresenceUpdate.bind(this);
    this.rendererRenderHandler = this.refreshOverlays.bind(this);
    this.focusHandler = this.syncLocalCursor.bind(this);
    this.blurHandler = this.syncLocalCursor.bind(this);
    this.cursorTicker = debounce(() => this.broadcastCursor(), 60);

    this.session.on('change', this.changeHandler);
    this.editor.selection.on('changeCursor', this.cursorChangeHandler);
    this.editor.selection.on('changeSelection', this.cursorChangeHandler);
    this.bus?.on('collab:code:op', this.remoteOpHandler);
    this.bus?.on('collab:code:cursor', this.remoteCursorHandler);
    this.bus?.on('collab:presence:update', this.presenceHandler);
    this.bus?.on('collab:leave', this.presenceHandler);
    this.editor.renderer.on?.('afterRender', this.rendererRenderHandler);
    this.editor.on?.('focus', this.focusHandler);
    this.editor.on?.('blur', this.blurHandler);

    this.syncLocalCursor();
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
    this.editor.renderer.off?.('afterRender', this.rendererRenderHandler);
    this.editor.renderer.removeListener?.('afterRender', this.rendererRenderHandler);
    this.editor.off?.('focus', this.focusHandler);
    this.editor.off?.('blur', this.blurHandler);
    this.editor.removeListener?.('focus', this.focusHandler);
    this.editor.removeListener?.('blur', this.blurHandler);
    for (let entry of this.remoteCursors.values()) this.removeRemoteCursor(entry);
    this.remoteCursors.clear();
    this.overlayRoot?.remove?.();
    this.overlayRoot = null;
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
    this.syncLocalCursor();
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
    let classes = ensureColorClasses(this.resolvePeerColor(ev.peer));
    this.upsertRemoteCursor(ev.peer, cursor, classes);
  }

  handlePresenceUpdate() {
    if (this.disposed) return;
    let presence = state.collab?.rtc?.presence || [];
    let active = new Map(presence.map(x => [x.user, x]));
    if (!active.has(this.clientId)) {
      active.set(this.clientId, { user: this.clientId, color: this.resolvePeerColor(this.clientId) });
    }
    for (let [peer, entry] of this.remoteCursors.entries()) {
      let info = active.get(peer);
      if (!info) {
        this.removeRemoteCursor(entry);
        this.remoteCursors.delete(peer);
        continue;
      }
      let classes = ensureColorClasses(this.resolvePeerColor(peer) ?? info.color);
      let selectionChanged = entry.classes?.selection !== classes.selection;
      let caretChanged = entry.classes?.caret !== classes.caret;
      if (!selectionChanged && !caretChanged) continue;
      entry.classes = classes;
      this.positionRemoteCursor(peer, entry);
    }
    this.syncLocalCursor();
  }

  upsertRemoteCursor(peer, cursor, classes) {
    let entry = this.remoteCursors.get(peer);
    if (!entry) {
      entry = {
        caretEl: null,
        selectionEls: [],
        classes,
        cursor: null,
      };
      this.remoteCursors.set(peer, entry);
    }
    entry.classes = classes;
    entry.cursor = cloneCursor(cursor);
    this.positionRemoteCursor(peer, entry);
  }

  removeRemoteCursor(entry) {
    if (!entry) return;
    if (entry.selectionEls) {
      for (let el of entry.selectionEls) el?.remove?.();
      entry.selectionEls.length = 0;
    }
    entry.selectionEls = [];
    entry.caretEl?.remove?.();
    entry.caretEl = null;
    entry.cursor = null;
    entry.classes = null;
  }

  ensureOverlayRoot() {
    if (this.disposed) return null;
    let renderer = this.editor?.renderer;
    if (!renderer || !renderer.content) return null;
    let root = this.overlayRoot;
    if (!root || !root.isConnected) {
      root = document.createElement('div');
      root.className = 'ace-collab-overlays';
      renderer.content.append(root);
      this.overlayRoot = root;
    } else if (root.parentElement !== renderer.content) {
      renderer.content.append(root);
    }
    return this.overlayRoot;
  }

  getRendererMetrics() {
    let renderer = this.editor?.renderer;
    if (!renderer) return null;
    let lineHeight = renderer.lineHeight || renderer.layerConfig?.lineHeight;
    let characterWidth = renderer.characterWidth || renderer.layerConfig?.characterWidth;
    let padding = typeof renderer.$padding === 'number' ? renderer.$padding : renderer.layerConfig?.padding || 0;
    if (!lineHeight || !characterWidth) return null;
    return { lineHeight, characterWidth, padding };
  }

  positionRemoteCursor(peer, entry) {
    if (!entry || !entry.cursor) return;
    let root = this.ensureOverlayRoot();
    if (!root) return;
    let metrics = this.getRendererMetrics();
    if (!metrics) return;
    let { lineHeight, characterWidth, padding } = metrics;
    let session = this.session;
    let endPos = session.documentToScreenPosition(entry.cursor.end.row, entry.cursor.end.column);
    if (!endPos) return;

    let caretEl = entry.caretEl;
    if (!caretEl || !caretEl.isConnected) {
      caretEl = document.createElement('div');
      entry.caretEl = caretEl;
      root.append(caretEl);
    }
    caretEl.className = entry.classes.caret;
    caretEl.style.top = `${(padding + endPos.row * lineHeight) - 3}px`;
    caretEl.style.left = `${padding + endPos.column * characterWidth}px`;
    caretEl.style.height = `${lineHeight}px`;
    caretEl.style.display = peer === this.clientId && !this.editor.isFocused?.() ? 'none' : 'block';

    let segments = computeSelectionSegments(session, entry.cursor);
    if (!entry.selectionEls) entry.selectionEls = [];
    if (!segments.length) {
      for (let el of entry.selectionEls) el?.remove?.();
      entry.selectionEls.length = 0;
      return;
    }
    for (let i = 0; i < segments.length; i++) {
      let seg = segments[i];
      let el = entry.selectionEls[i];
      if (!el || !el.isConnected) {
        el = document.createElement('div');
        entry.selectionEls[i] = el;
        root.append(el);
      }
      let width = (seg.endColumn - seg.startColumn) * characterWidth;
      if (width < 0) width = 0;
      width = Math.max(characterWidth, width);
      el.className = entry.classes.selection;
      el.style.top = `${(padding + seg.row * lineHeight) - 3}px`;
      el.style.left = `${padding + seg.startColumn * characterWidth}px`;
      el.style.height = `${lineHeight}px`;
      el.style.width = `${width}px`;
    }
    while (entry.selectionEls.length > segments.length) {
      let el = entry.selectionEls.pop();
      el?.remove?.();
    }
  }

  refreshOverlays() {
    if (this.disposed) return;
    if (!this.remoteCursors.size) return;
    for (let [peer, entry] of this.remoteCursors.entries()) this.positionRemoteCursor(peer, entry);
  }

  resolvePeerColor(peer) {
    let presence = state.collab?.rtc?.presence || [];
    let info = presence.find(x => x.user === peer);
    if (info?.color) return info.color;
    if (peer === this.clientId) return state.collab?.rtc?.color;
    return undefined;
  }

  syncLocalCursor() {
    if (this.disposed) return;
    if (!this.editor?.selection) return;
    let range = this.editor.selection.getRange?.();
    if (!range) return;
    let cursor = {
      start: { row: range.start.row, column: range.start.column },
      end: { row: range.end.row, column: range.end.column },
      isEmpty: range.isEmpty(),
    };
    let classes = ensureColorClasses(this.resolvePeerColor(this.clientId));
    this.upsertRemoteCursor(this.clientId, cursor, classes);
  }
}
