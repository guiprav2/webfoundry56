import rfiles from '../repos/rfiles.js';
import { debounce, isMedia } from '../other/util.js';
import { loadCodeMirrorBase, mountCodeMirror } from '../other/codemirror.js';
import { createYjsBackend } from '../components/CodeEditor.js';
import { lookup as mimeLookup } from 'https://esm.sh/mrmime';

const FALLBACK_CURSOR_COLOR = 'sky-500';
const CURSOR_BROADCAST_MIN_INTERVAL = 50;

export default class CodeEditor {
  state = {
    target(path) { return (path && !isMedia(path) && !(/^components\/|pages\//.test(path) && path.endsWith('.html'))) },
    editorHandle: null,
    yBackend: null,
    changeHandler: null,
    currentPath: null,
    currentProject: null,
    pendingSelection: null,
    ready: false,
    cursorStyleHandler: null,
    syncLocalCursorStyles: null,
    remoteCursorMarkers: new Map(),
    cursorRTC: null,
    cursorRTCHandler: null,
    lastCursorBroadcast: 0,
    presenceListener: null,
  };

  peerClassCache = new Map();

  getPeerClass = peer => {
    if (!peer) return 'peer-unknown';
    if (this.peerClassCache.has(peer)) return this.peerClassCache.get(peer);
    let sanitized = `peer-${peer}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!/^[a-zA-Z_]/.test(sanitized)) sanitized = `peer-${sanitized}`;
    this.peerClassCache.set(peer, sanitized);
    return sanitized;
  };

  getPeerColor = peer => state.collab.rtc?.presence?.find?.(x => x.user === peer)?.color || null;

  attachCursorRTC = rtc => {
    if (this.state.cursorRTC === rtc) return;
    this.detachCursorRTC();
    if (!rtc?.events) return;
    this.state.cursorRTCHandler ??= message => this.handleRemoteCursorMessage(message);
    this.state.cursorRTC = rtc;
    rtc.events.on('codeEditor:cursor', this.state.cursorRTCHandler);
  };

  detachCursorRTC = () => {
    if (!this.state.cursorRTC) return;
    try {
      this.state.cursorRTC.events.off('codeEditor:cursor', this.state.cursorRTCHandler);
    } catch {}
    this.state.cursorRTC = null;
  };

  handleRemoteCursorMessage = message => {
    if (!message || message.peer === state.collab.uid) return;
    if (message.project !== this.state.currentProject) {
      this.clearRemoteCursor(message.peer);
      return;
    }
    if (message.path !== this.state.currentPath) {
      this.clearRemoteCursor(message.peer);
      return;
    }
    if (!Array.isArray(message.ranges)) {
      this.clearRemoteCursor(message.peer);
      return;
    }
    if (!this.state.editorHandle?.editor) return;
    this.renderRemoteCursor(message.peer, message.ranges);
  };

  broadcastCursor = (force = false) => {
    let editor = this.state.editorHandle?.editor;
    let rtc = state.collab.rtc;
    if (!editor || !rtc || !this.state.currentProject || !this.state.currentPath) return;
    let doc = editor.getDoc?.();
    if (!doc?.listSelections) return;
    let now = performance.now();
    if (!force && now - this.state.lastCursorBroadcast < CURSOR_BROADCAST_MIN_INTERVAL) return;
    this.state.lastCursorBroadcast = now;
    let ranges = doc.listSelections().map(sel => ({
      anchor: { line: sel.anchor.line, ch: sel.anchor.ch },
      head: { line: sel.head.line, ch: sel.head.ch },
    }));
    try {
      rtc.send({
        type: 'codeEditor:cursor',
        project: this.state.currentProject,
        path: this.state.currentPath,
        ranges,
      });
    } catch (err) {
      console.error('CodeEditor cursor broadcast error', err);
    }
  };

  clearRemoteCursor = peer => {
    let data = this.state.remoteCursorMarkers.get(peer);
    if (!data) return;
    let editor = this.state.editorHandle?.editor;
    let clearMarks = () => {
      for (let mark of data.selections || []) {
        try { mark?.clear?.(); } catch {}
      }
      for (let mark of data.cursors || []) {
        try { mark?.clear?.(); } catch {}
      }
    };
    if (editor) editor.operation(clearMarks);
    else clearMarks();
    this.state.remoteCursorMarkers.delete(peer);
  };

  clearAllRemoteCursors = () => {
    for (let peer of [...this.state.remoteCursorMarkers.keys()]) this.clearRemoteCursor(peer);
    this.state.remoteCursorMarkers.clear();
  };

  renderRemoteCursor = (peer, ranges = []) => {
    let editor = this.state.editorHandle?.editor;
    if (!editor) return;
    let doc = editor.getDoc?.();
    if (!doc) return;
    let normalized = [];
    for (let range of ranges) {
      if (!range) continue;
      let anchor = range.anchor || {};
      let head = range.head || {};
      try {
        let anchorPos = doc.clipPos?.({ line: anchor.line ?? 0, ch: anchor.ch ?? 0 }) ?? { line: anchor.line ?? 0, ch: anchor.ch ?? 0 };
        let headPos = doc.clipPos?.({ line: head.line ?? 0, ch: head.ch ?? 0 }) ?? { line: head.line ?? 0, ch: head.ch ?? 0 };
        let anchorIndex = doc.indexFromPos?.(anchorPos);
        let headIndex = doc.indexFromPos?.(headPos);
        if (anchorIndex == null || headIndex == null) continue;
        let from = anchorIndex <= headIndex ? anchorPos : headPos;
        let to = anchorIndex <= headIndex ? headPos : anchorPos;
        normalized.push({ anchor: anchorPos, head: headPos, from, to, collapsed: anchorIndex === headIndex });
      } catch {}
    }
    this.clearRemoteCursor(peer);
    if (!normalized.length) return;
    let selectionMarkers = [];
    let cursorMarkers = [];
    let color = this.getPeerColor(peer) || FALLBACK_CURSOR_COLOR;
    let peerCls = this.getPeerClass(peer);
    editor.operation(() => {
      for (let { from, to, head, collapsed } of normalized) {
        if (!collapsed) {
          let mark = doc.markText(from, to, {
            className: `CodeMirror-remote-selection ${peerCls ? `CodeMirror-remote-selection-${peerCls}` : ''}`.trim(),
            inclusiveLeft: true,
            inclusiveRight: true,
          });
          selectionMarkers.push(mark);
        }
        try {
          let widget = this.createRemoteCursorWidget(peer);
          let bookmark = doc.setBookmark(head, { widget, insertLeft: true });
          cursorMarkers.push(bookmark);
        } catch (err) {
          console.error('CodeEditor remote cursor widget error', err);
        }
      }
    });
    let storedRanges = normalized.map(({ anchor, head }) => ({ anchor: { line: anchor.line, ch: anchor.ch }, head: { line: head.line, ch: head.ch } }));
    this.state.remoteCursorMarkers.set(peer, { selections: selectionMarkers, cursors: cursorMarkers, color, ranges: storedRanges });
    this.applyRemoteCursorColor(peer, color);
  };

  applyRemoteCursorColor = (peer, color) => {
    let editor = this.state.editorHandle?.editor;
    if (!editor) return;
    let wrap = editor.getWrapperElement?.();
    if (!wrap) return;
    let peerCls = this.getPeerClass(peer);
    let selectionNodes = wrap.querySelectorAll(`.CodeMirror-remote-selection-${peerCls}`);
    let cursorNodes = wrap.querySelectorAll(`.CodeMirror-remote-cursor-${peerCls}`);
    let selectionColor = color || FALLBACK_CURSOR_COLOR;
    for (let node of selectionNodes) {
      for (let cls of [...node.classList]) {
        if (/^bg-.*!$/.test(cls) || cls === 'opacity-30' || cls === 'opacity-40') node.classList.remove(cls);
      }
      node.classList.add(`bg-${selectionColor}!`, 'opacity-30');
      node.dataset.peer = peer;
    }
    let lineHeight = editor.defaultTextHeight?.() ?? 16;
    for (let node of cursorNodes) {
      for (let cls of [...node.classList]) {
        if (/^border-.*!$/.test(cls)) node.classList.remove(cls);
      }
      node.classList.add(`border-${selectionColor}!`);
      node.dataset.peer = peer;
      node.style.borderLeftWidth = node.style.borderLeftWidth || '2px';
      node.style.borderLeftStyle = node.style.borderLeftStyle || 'solid';
      node.style.marginLeft = node.style.marginLeft || '-1px';
      node.style.pointerEvents = 'none';
      node.style.width = node.style.width || '0px';
      node.style.height = `${lineHeight}px`;
      node.style.display = node.style.display || 'inline-block';
      node.style.boxSizing = node.style.boxSizing || 'border-box';
      node.style.opacity = node.style.opacity || '0.9';
    }
  };

  refreshRemoteCursorColors = () => {
    if (!this.state.remoteCursorMarkers.size) return;
    let entries = Array.from(this.state.remoteCursorMarkers.entries());
    for (let [peer, data] of entries) {
      if (!data?.ranges?.length) continue;
      this.renderRemoteCursor(peer, data.ranges);
    }
  };

  removeStaleRemoteCursors = () => {
    if (!this.state.remoteCursorMarkers.size) return;
    let active = new Set(state.collab.rtc?.presence?.map?.(x => x.user) || []);
    for (let peer of [...this.state.remoteCursorMarkers.keys()]) {
      if (peer === state.collab.uid) continue;
      if (!active.has(peer)) this.clearRemoteCursor(peer);
    }
  };

  handlePresenceUpdate = () => {
    this.attachCursorRTC(state.collab.rtc);
    this.removeStaleRemoteCursors();
    this.refreshRemoteCursorColors();
    this.state.syncLocalCursorStyles?.();
    this.broadcastCursor(true);
  };

  createRemoteCursorWidget = peer => {
    let el = document.createElement('span');
    let peerCls = this.getPeerClass(peer);
    el.className = `CodeMirror-remote-cursor ${peerCls ? `CodeMirror-remote-cursor-${peerCls}` : ''}`.trim();
    el.dataset.peer = peer;
    let lineHeight = this.state.editorHandle?.editor?.defaultTextHeight?.() ?? 16;
    el.style.borderLeftWidth = '2px';
    el.style.borderLeftStyle = 'solid';
    el.style.marginLeft = '-1px';
    el.style.pointerEvents = 'none';
    el.style.width = '0px';
    el.style.height = `${lineHeight}px`;
    el.style.display = 'inline-block';
    el.style.boxSizing = 'border-box';
    el.style.opacity = '0.9';
    el.textContent = '\u200b';
    return el;
  };

  actions = {
    init: () => {
      let { bus } = state.event;
      if (!document.getElementById('CodeEditorStyles')) {
        document.head.append(d.el('style', { id: 'CodeEditorStyles' }, `
          .CodeMirror { height: 100%; background-color: #04060960 !important }
          .CodeMirror-gutters { background-color: #060a0f60 !important; }
          .CodeMirror-activeline-background { background-color: #0009 !important; }
          .CodeMirror-activeline .CodeMirror-gutter-elt { background-color: #0009 !important; }
          .CodeMirror-code { position: absolute; top: 0 }
          .CodeMirror-cursor { margin-top: -16px }
          .CodeMirror-remote-cursor { position: relative; top: 2px }
        `));
      }
      this.attachCursorRTC(state.collab.rtc);
      if (!this.state.presenceListener) {
        this.state.presenceListener = () => this.handlePresenceUpdate();
        bus.on('collab:presence:update', this.state.presenceListener);
      }
      bus.on('files:select:ready', async ({ project, path }) => await post('codeEditor.open'));
      bus.on('collab:apply:ready', async () => {
        if (state.collab.uid === 'master') return;
        if (!state.files.current) return;
        await post('codeEditor.open');
      });
      loadCodeMirrorBase()
        .then(async () => {
          this.state.ready = true;
          if (this.state.pendingSelection) {
            this.state.pendingSelection = null;
            await this.actions.open();
          }
          bus.emit('codeEditor:init:ready');
        })
        .catch(err => bus.emit('codeEditor:script:error', { error: err }));
      bus.on('settings:global:option:ready', async ({ k, v }) => {
        switch (k) {
          case 'vim':
            await this.state.editorHandle?.setKeyMap?.(v ? 'vim' : 'default');
            break;
          case 'codeTheme': {
            let theme = v || state.settings.opt.codeTheme || 'monokai';
            await this.state.editorHandle?.setTheme?.(theme);
            break;
          }
          case 'codeFontSize': {
            let size = state.settings.opt.codeFontSize || v || '16px';
            let wrap = this.state.editorHandle?.editor?.getWrapperElement?.();
            if (wrap) {
              wrap.style.fontSize = typeof size === 'number' ? `${size}px` : size;
              this.state.editorHandle.editor.refresh();
              this.refreshRemoteCursorColors();
            }
            break;
          }
          case 'codeTabSize': {
            let size = Number(v ?? state.settings.opt.codeTabSize) || 2;
            this.state.editorHandle?.editor?.setOption?.('tabSize', size);
            this.state.editorHandle?.editor?.setOption?.('indentUnit', size);
            break;
          }
          default:
            break;
        }
      });
    },

    open: async () => {
      let project = state.projects.current;
      let path = state.files.current;
      if (!path) return await post('codeEditor.reset');
      if (!this.state.target(path)) return;
      let type = mimeLookup(path);
      if (!type?.startsWith?.('text/') || type === 'text/html') return;
      if (this.state.currentPath === path) return;
      if (!this.state.ready) {
        this.state.pendingSelection = true;
        return;
      }
      await post('codeEditor.reset');
      d.updateSync();
      let wrapper = document.querySelector('#CodeEditor');
      if (!wrapper) return;
      let el = d.el('div', { class: 'w-full h-full' });
      wrapper.replaceChildren(el);
      let tabSize = state.settings.opt.codeTabSize || 2;
      let fontSize = state.settings.opt.codeFontSize || '16px';
      let modeKey = { html: 'html', css: 'css', js: 'javascript', md: 'markdown' }[path.split('.').pop()?.toLowerCase?.()] ?? null;
      let { editor, destroy, setTheme, setKeyMap, setMode } = await mountCodeMirror(el, {
        mode: modeKey,
        theme: state.settings.opt.codeTheme || 'monokai',
        keyMap: state.settings.opt.vim ? 'vim' : 'default',
        tabSize,
        fontSize,
        lineWrapping: false,
      });
      this.state.editorHandle = { editor, destroy, setTheme, setKeyMap, setMode };
      this.state.currentPath = path;
      this.state.currentProject = project;
      let initialText = '';
      if (state.collab.uid === 'master') {
        let blob = await rfiles.load(project, path);
        initialText = blob ? await blob.text() : '';
      }
      this.state.yBackend?.destroy?.();
      this.state.yBackend = createYjsBackend({
        editor,
        project,
        path,
        initialValue: initialText,
        clientId: state.collab.uid,
        isMaster: state.collab.uid === 'master',
        getRTC: () => state.collab.rtc,
        bus: state.event?.bus,
      });
      editor.getWrapperElement?.().classList?.add?.('w-full', 'h-full');
      editor.getDoc?.().clearHistory?.();
      let syncCursorSelectionClasses = () => {
        let wrap = editor.getWrapperElement?.();
        if (!wrap) return;
        let color = state.collab.rtc?.presence?.find?.(x => x.user === state.collab.uid)?.color || null;
        let cursor = wrap.querySelector('.CodeMirror-cursor');
        if (cursor) {
          for (let cls of [...cursor.classList]) if (/^border-.*!$/.test(cls)) cursor.classList.remove(cls);
        }
        wrap.querySelectorAll('.CodeMirror-selected').forEach(sel => {
          for (let cls of [...sel.classList]) if (/^bg-.*!$/.test(cls) || cls === 'opacity-30') sel.classList.remove(cls);
        });
        if (!color) return;
        if (cursor) cursor.classList.add(`border-${color}!`);
        wrap.querySelectorAll('.CodeMirror-selected').forEach(sel => sel.classList.add(`bg-${color}!`, 'opacity-30'));
      };
      this.state.syncLocalCursorStyles = syncCursorSelectionClasses;
      let handleCursorActivity = () => {
        queueMicrotask(syncCursorSelectionClasses);
        this.broadcastCursor();
      };
      editor.on('cursorActivity', handleCursorActivity);
      this.state.cursorStyleHandler = handleCursorActivity;
      queueMicrotask(syncCursorSelectionClasses);
      this.attachCursorRTC(state.collab.rtc);
      this.broadcastCursor(true);
      let changeHandler = async () => {
        if (!this.state.editorHandle?.editor) return;
        if (state.collab.uid !== 'master') return;
        await post('codeEditor.change');
      };
      editor.on('change', changeHandler);
      this.state.changeHandler = changeHandler;
      editor.focus();
    },

    reset: async () => {
      if (this.state.editorHandle?.editor && this.state.changeHandler) {
        this.state.editorHandle.editor.off('change', this.state.changeHandler);
      }
      if (this.state.editorHandle?.editor && this.state.cursorStyleHandler) {
        this.state.editorHandle.editor.off('cursorActivity', this.state.cursorStyleHandler);
      }
      if (state.collab.rtc && this.state.currentProject && this.state.currentPath) {
        try {
          await state.collab.rtc.send({
            type: 'codeEditor:cursor',
            project: this.state.currentProject,
            path: this.state.currentPath,
            ranges: [],
          });
        } catch (err) {
          console.error('CodeEditor cursor broadcast error', err);
        }
      }
      this.clearAllRemoteCursors();
      this.state.yBackend?.destroy?.();
      this.state.yBackend = null;
      this.state.editorHandle?.destroy?.();
      this.state.editorHandle = null;
      this.state.changeHandler = null;
      this.state.cursorStyleHandler = null;
      this.state.syncLocalCursorStyles = null;
      this.state.lastCursorBroadcast = 0;
      this.state.currentPath = null;
      this.state.currentProject = null;
      let wrapper = document.querySelector('#CodeEditor');
      if (wrapper) wrapper.innerHTML = '';
    },

    change: debounce(async () => {
      if (!this.state.editorHandle?.editor || !state.files.current) return;
      let type = mimeLookup(state.files.current);
      await rfiles.save(state.projects.current, state.files.current, new Blob([this.state.editorHandle.editor.getValue()], { type }));
    }, 200),
  };
}
