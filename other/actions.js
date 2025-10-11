import { lookup as mimeLookup } from 'https://esm.sh/mrmime';

let actions = {
  undo: {
    shortcut: 'Ctrl-z',
    disabled: () => [!state.designer.open && `Designer closed.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose history to undo (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'undo' });
      let frame = state.designer.current;
      if (!frame.history[cur] || frame.ihistory[cur] < 1) return;
      --frame.ihistory[cur];
      await frame.history[cur][frame.ihistory[cur]](false);
    },
  },

  redo: {
    shortcut: 'Ctrl-y',
    disabled: () => [!state.designer.open && `Designer closed.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose history to redo (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'redo' });
      let frame = state.designer.current;
      if (!frame.history[cur] || !frame.history[cur][frame.ihistory[cur]]) return;
      await frame.history[cur][frame.ihistory[cur]](true);
      ++frame.ihistory[cur];
    },
  },

  changeSelection: {
    description: `Select elements based on their data-htmlsnap IDs`,
    disabled: () => [!state.designer.open && `Designer closed.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to move (defaults to master)` },
        s: { type: 'array', items: { type: 'string' }, description: `IDs to select` },
      },
    },
    handler: async ({ cur = 'master', s } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeSelection', cur, s });
      let frame = state.designer.current;
      s = [...new Set(s.map(x => frame.map.get(x)).filter(x => frame.body.contains(x)).map(x => frame.map.getKey(x)).filter(Boolean))];
      if (!s.length) frame.lastCursors[cur] = frame.cursors[cur];
      frame.cursors[cur] = s;
      d.update();
      await post('collab.sync');
    },
  },

  toggleSelection: {
    description: [
      `Toggles the current element selections;`,
      `if there is a selection, it unselects;`,
      `otherwise it restores the previous selection;`,
      `only use upon explicit user request`,
    ].join(' '),
    shortcut: 'Escape',
    disabled: () => [!state.designer.open && `Designer closed.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to toggle (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'toggleSelection', cur });
      let frame = state.designer.current;
      let sel = frame.cursors[cur] || [];
      if (sel.length) await actions.changeSelection.handler({ cur, s: [] });
      else if (frame.lastCursors[cur]?.length) await actions.changeSelection.handler({ cur, s: frame.lastCursors[cur] });
    },
  },

  selectParentElement: {
    description: `Moves selection to the parent element`,
    shortcut: ['ArrowLeft', 'h'],
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to move (defaults to master)` },
        i: { type: 'number', description: `How far to go (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'selectParentElement', cur, i });
      let k = 'parentElement';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        s[k] && frame.body.contains(s[k]) && await actions.changeSelection.handler({ cur, s: [frame.map.getKey(s[k])] });
      }
    },
  },

  selectNextSibling: {
    shortcut: ['ArrowDown', 'j'],
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to move (defaults to master)` },
        i: { type: 'number', description: `How far to go (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'selectNextSibling', cur, i });
      let k = 'nextElementSibling';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        s[k] && frame.body.contains(s[k]) && await actions.changeSelection.handler({ cur, s: [frame.map.getKey(s[k])] });
      }
    },
  },

  selectPrevSibling: {
    shortcut: ['ArrowUp', 'k'],
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to move (defaults to master)` },
        i: { type: 'number', description: `How far to go (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'selectPrevSibling', cur, i });
      let k = 'previousElementSibling';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        s[k] && frame.body.contains(s[k]) && await actions.changeSelection.handler({ cur, s: [frame.map.getKey(s[k])] });
      }
    },
  },

  selectFirstChild: {
    shortcut: ['ArrowRight', 'l'],
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to move (defaults to master)` },
        i: { type: 'number', description: `How far to go (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'selectFirstChild', cur, i });
      let k = 'firstElementChild';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        s[k] && frame.body.contains(s[k]) && await actions.changeSelection.handler({ cur, s: [frame.map.getKey(s[k])] });
      }
    },
  },

  selectLastChild: {
    shortcut: ['ArrowRight', 'l'],
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to move (defaults to master)` },
        i: { type: 'number', description: `How far to go (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'selectLastChild', cur, i });
      let k = 'lastElementChild';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        s[k] && frame.body.contains(s[k]) && await actions.changeSelection.handler({ cur, s: [frame.map.getKey(s[k])] });
      }
    },
  },

  createNextSibling: {
    shortcut: 'a',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'string', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createNextSibling', cur, tag, i });
      let pos = 'afterend';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let created = [];
      let parents = [];
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        let p = s.parentElement;
        let j = [...p.childNodes].indexOf(s);
        let k = 1;
        let pv;
        if (s.tagName === 'BODY' && (pos === 'beforebegin' || pos === 'afterend')) continue;
        let x = d.el(tag);
        created.push(x);
        parents.push(s);
      }
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let i = 0; i < created.length; i++) parents[i].insertAdjacentElement(pos, created[i]);
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: created.map(x => frame.map.getKey(x)) });
        } else {
          for (let i = 0; i < created.length; i++) created[i].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: [frame.cursors[cur][0]] });
        }
      });
    },
  },

  createPrevSibling: {
    shortcut: 'A',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'string', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createPrevSibling', cur, tag, i });
      let pos = 'beforebegin';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let created = [];
      let parents = [];
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        let p = s.parentElement;
        let j = [...p.childNodes].indexOf(s);
        let k = 1;
        let pv;
        if (s.tagName === 'BODY' && (pos === 'beforebegin' || pos === 'afterend')) continue;
        let x = d.el(tag);
        created.push(x);
        parents.push(s);
      }
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let i = 0; i < created.length; i++) parents[i].insertAdjacentElement(pos, created[i]);
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: created.map(x => frame.map.getKey(x)) });
        } else {
          for (let i = 0; i < created.length; i++) created[i].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: [frame.cursors[cur][0]] });
        }
      });
    },
  },

  createLastChild: {
    shortcut: 'i',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'string', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createLastChild', cur, tag, i });
      let pos = 'beforeend';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let created = [];
      let parents = [];
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        let p = s.parentElement;
        let j = [...p.childNodes].indexOf(s);
        let k = 1;
        let pv;
        if (s.tagName === 'BODY' && (pos === 'beforebegin' || pos === 'afterend')) continue;
        let x = d.el(tag);
        created.push(x);
        parents.push(s);
      }
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let i = 0; i < created.length; i++) parents[i].insertAdjacentElement(pos, created[i]);
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: created.map(x => frame.map.getKey(x)) });
        } else {
          for (let i = 0; i < created.length; i++) created[i].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: [frame.cursors[cur][0]] });
        }
      });
    },
  },

  createFirstChild: {
    shortcut: 'I',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'string', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createFirstChild', cur, tag, i });
      let pos = 'afterbegin';
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let created = [];
      let parents = [];
      while (i-- > 0) {
        let s = frame.map.get(frame.cursors[cur][0]);
        let p = s.parentElement;
        let j = [...p.childNodes].indexOf(s);
        let k = 1;
        let pv;
        if (s.tagName === 'BODY' && (pos === 'beforebegin' || pos === 'afterend')) continue;
        let x = d.el(tag);
        created.push(x);
        parents.push(s);
      }
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let i = 0; i < created.length; i++) parents[i].insertAdjacentElement(pos, created[i]);
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: created.map(x => frame.map.getKey(x)) });
        } else {
          for (let i = 0; i < created.length; i++) created[i].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: [frame.cursors[cur][0]] });
        }
      });
    },
  },

  changeElementTag: {
    shortcut: 'e',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selection to change tag (defaults to master)` },
        tag: { type: 'string', description: `New tag name (default prompts user)` },
      },
    },
    handler: async ({ cur = 'master', tag = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (!tag) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change tag', label: 'Tag name', initialValue: targets[0].tagName.toLowerCase() });
        if (btn !== 'ok' || !val.trim()) return;
        tag = val.trim();
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeElementTag', cur, tag });
      let parents = targets.map(x => x.parentElement);
      let idxs = targets.map(x => [...x.parentElement.children].indexOf(x));
      let oldEls = targets.map(x => x);
      let newEls = targets.map(el => {
        if (el.tagName.toLowerCase() === tag) return el;
        let clone = document.createElement(tag);
        for (let attr of el.attributes) clone.setAttribute(attr.name, attr.value);
        clone.innerHTML = el.innerHTML;
        return clone;
      });
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < oldEls.length; n++) {
            let p = parents[n];
            let i = idxs[n];
            let oldEl = oldEls[n];
            let newEl = newEls[n];
            if (oldEl !== newEl && p.children[i] === oldEl) {
              p.replaceChild(newEl, oldEl);
            }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: newEls.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < oldEls.length; n++) {
            let p = parents[n];
            let i = idxs[n];
            let oldEl = oldEls[n];
            let newEl = newEls[n];
            if (oldEl !== newEl && p.children[i] === newEl) {
              p.replaceChild(oldEl, newEl);
            }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: oldEls.map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  copySelected: {
    description: `Copies currently selected element(s)`,
    shortcut: 'c',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selection to copy (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'copySelected', cur });
      let frame = state.designer.current;
      let els = frame.cursors[cur].map(id => frame.map.get(id)).filter(Boolean);
      let html = els.map(n => n.outerHTML).join('\n');
      state.designer.clipboards[cur] = html;
      localStorage.setItem('webfoundry:clipboard', html);
      d.update();
      await post('collab.sync');
    },
  },

  deleteSelected: {
    description: `Deletes and copies currently selected element(s)`,
    shortcut: 'd',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        i: { type: 'number', description: `How many times to delete (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'deleteSelected', cur });
      let frame = state.designer.current;
      await actions.copySelected.handler({ cur });
      while (i-- > 0) {
        let ss = frame.cursors[cur].map(x => frame.map.get(x)).filter(x => x !== frame.root && x !== frame.body && x !== frame.head);
        if (!ss.length) return;
        let select = new Set();
        let removed = [];
        let ps = ss.map(x => x.parentElement);
        let idxs = ss.map(x => [...x.parentElement.children].indexOf(x));
        for (let s of ss) {
          let p = s.parentElement;
          let i = [...p.children].indexOf(s);
          s.remove();
          removed.push(s);
          select.add(ss.length === 1 ? p.children[i] || p.children[i - 1] || p : p.children[i - 1]);
        }
        select = [...select].filter(Boolean).filter(x => !removed.includes(x));
        if (!select.length) select.push(...ps);
        await post('designer.pushHistory', cur, async apply => {
          if (apply) {
            for (let s of removed) s.remove();
            await new Promise(pres => setTimeout(pres));
            await actions.changeSelection.handler({ cur, s: select.map(x => frame.map.getKey(x)) });
          } else {
            for (let n = 0; n < removed.length; n++) {
              let p = ps[n];
              let i = idxs[n];
              if (p.children[i]) p.insertBefore(removed[n], p.children[i]); else p.appendChild(removed[n]);
            }
            await new Promise(pres => setTimeout(pres));
            await actions.changeSelection.handler({ cur, s: removed.map(x => frame.map.getKey(x)) });
          }
        });
      }
    },
  },

  pasteNextSibling: {
    description: `Pastes copied elements as the next sibling`,
    shortcut: 'p',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Target cursor for paste (defaults to master)` },
        i: { type: 'number', description: `How many copies to paste (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => { // FIXME: Implement i, fix paste order, all equivalents
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pasteNextSibling', cur, i });
      let pos = 'afterend';
      let frame = state.designer.current;
      let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard');
      if (!html) return;
      let template = document.createElement('template');
      template.innerHTML = html;
      let fragments = [...template.content.children];
      if (!fragments.length) return;
      let cursors = frame.cursors[cur];
      let clones = [];
      let reversed = pos === 'afterbegin';
      if (cursors.length === 1) {
        let id = cursors[0];
        let x = frame.map.get(id);
        if (!x) return;
        let items = reversed ? [...fragments].reverse() : fragments;
        for (let i = 0; i < items.length; i++) {
          let y = items[i].cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      } else {
        let items = reversed ? [...cursors].reverse() : cursors;
        for (let i = 0; i < items.length; i++) {
          let id = items[i];
          let x = frame.map.get(id);
          if (!x) continue;
          let frag = fragments[i % fragments.length];
          let y = frag.cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      }
      await new Promise(res => setTimeout(res));
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < clones.length; n++) {
            let y = clones[n];
            if (!y.isConnected) {
              let ref = cursors[n % cursors.length];
              let x = frame.map.get(ref);
              if (x) x.insertAdjacentElement(pos, y);
            }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: clones.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < clones.length; n++) clones[n].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: cursors.map(x => frame.map.get(x)).filter(Boolean).map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  pastePrevSibling: {
    description: `Pastes copied elements as the previous sibling`,
    shortcut: 'P',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Target cursor for paste (defaults to master)` },
        i: { type: 'number', description: `How many copies to paste (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pastePrevSibling', cur, i });
      let pos = 'beforebegin';
      let frame = state.designer.current;
      let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard');
      if (!html) return;
      let template = document.createElement('template');
      template.innerHTML = html;
      let fragments = [...template.content.children];
      if (!fragments.length) return;
      let cursors = frame.cursors[cur];
      let clones = [];
      let reversed = pos === 'afterbegin';
      if (cursors.length === 1) {
        let id = cursors[0];
        let x = frame.map.get(id);
        if (!x) return;
        let items = reversed ? [...fragments].reverse() : fragments;
        for (let i = 0; i < items.length; i++) {
          let y = items[i].cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      } else {
        let items = reversed ? [...cursors].reverse() : cursors;
        for (let i = 0; i < items.length; i++) {
          let id = items[i];
          let x = frame.map.get(id);
          if (!x) continue;
          let frag = fragments[i % fragments.length];
          let y = frag.cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      }
      await new Promise(res => setTimeout(res));
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < clones.length; n++) {
            let y = clones[n];
            if (!y.isConnected) {
              let ref = cursors[n % cursors.length];
              let x = frame.map.get(ref);
              if (x) x.insertAdjacentElement(pos, y);
            }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: clones.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < clones.length; n++) clones[n].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: cursors.map(x => frame.map.get(x)).filter(Boolean).map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  pasteLastChild: {
    description: `Pastes copied elements as the last child`,
    shortcut: 'o',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Target cursor for paste (defaults to master)` },
        i: { type: 'number', description: `How many copies to paste (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pasteLastChild', cur, i });
      let pos = 'beforeend';
      let frame = state.designer.current;
      let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard');
      if (!html) return;
      let template = document.createElement('template');
      template.innerHTML = html;
      let fragments = [...template.content.children];
      if (!fragments.length) return;
      let cursors = frame.cursors[cur];
      let clones = [];
      let reversed = pos === 'afterbegin';
      if (cursors.length === 1) {
        let id = cursors[0];
        let x = frame.map.get(id);
        if (!x) return;
        let items = reversed ? [...fragments].reverse() : fragments;
        for (let i = 0; i < items.length; i++) {
          let y = items[i].cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      } else {
        let items = reversed ? [...cursors].reverse() : cursors;
        for (let i = 0; i < items.length; i++) {
          let id = items[i];
          let x = frame.map.get(id);
          if (!x) continue;
          let frag = fragments[i % fragments.length];
          let y = frag.cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      }
      await new Promise(res => setTimeout(res));
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < clones.length; n++) {
            let y = clones[n];
            if (!y.isConnected) {
              let ref = cursors[n % cursors.length];
              let x = frame.map.get(ref);
              if (x) x.insertAdjacentElement(pos, y);
            }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: clones.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < clones.length; n++) clones[n].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: cursors.map(x => frame.map.get(x)).filter(Boolean).map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  pasteFirstChild: {
    description: `Pastes copied elements as the first child`,
    shortcut: 'O',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Target cursor for paste (defaults to master)` },
        i: { type: 'number', description: `How many copies to paste (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pasteFirstChild', cur, i });
      let pos = 'afterbegin';
      let frame = state.designer.current;
      let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard');
      if (!html) return;
      let template = document.createElement('template');
      template.innerHTML = html;
      let fragments = [...template.content.children];
      if (!fragments.length) return;
      let cursors = frame.cursors[cur];
      let clones = [];
      let reversed = pos === 'afterbegin';
      if (cursors.length === 1) {
        let id = cursors[0];
        let x = frame.map.get(id);
        if (!x) return;
        let items = reversed ? [...fragments].reverse() : fragments;
        for (let i = 0; i < items.length; i++) {
          let y = items[i].cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      } else {
        let items = reversed ? [...cursors].reverse() : cursors;
        for (let i = 0; i < items.length; i++) {
          let id = items[i];
          let x = frame.map.get(id);
          if (!x) continue;
          let frag = fragments[i % fragments.length];
          let y = frag.cloneNode(true);
          y.removeAttribute('data-htmlsnap');
          x.insertAdjacentElement(pos, y);
          clones.push(y);
        }
      }
      await new Promise(res => setTimeout(res));
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < clones.length; n++) {
            let y = clones[n];
            if (!y.isConnected) {
              let ref = cursors[n % cursors.length];
              let x = frame.map.get(ref);
              if (x) x.insertAdjacentElement(pos, y);
            }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: clones.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < clones.length; n++) clones[n].remove();
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: cursors.map(x => frame.map.get(x)).filter(Boolean).map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  wrap: {
    description: `Wraps selected elements with a new element`,
    shortcut: 'w',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selection to wrap (defaults to master)` },
        tag: { type: 'string', description: `Tag to wrap with (defaults to div)` },
        i: { type: 'number', description: `How many wraps (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'wrap', cur, tag, i });
      let frame = state.designer.current;
      let els = frame.cursors[cur].map(id => frame.map.get(id)).filter(Boolean);
      let parents = els.map(x => x.parentElement);
      let idxs = els.map(x => [...x.parentElement.children].indexOf(x));
      let wrapperChains = els.map(() => []);
      for (let n = 0; n < els.length; n++) {
        let chain = [];
        for (let j = 0; j < i; j++) chain.push(document.createElement(tag));
        wrapperChains[n] = chain;
      }
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < els.length; n++) {
            let node = els[n];
            let p = parents[n];
            let before = p.children[idxs[n]];
            let chain = wrapperChains[n];
            let outer = chain[0];
            let inner = chain.at(-1);
            p.insertBefore(outer, before);
            for (let k = 1; k < chain.length; k++) chain[k - 1].appendChild(chain[k]);
            inner.appendChild(node);
          }
          await new Promise(pres => setTimeout(pres));
          let selection = wrapperChains.map(c => c[0]);
          await actions.changeSelection.handler({ cur, s: selection.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = els.length - 1; n >= 0; n--) {
            let node = els[n];
            let p = parents[n];
            let chain = wrapperChains[n];
            let outer = chain[0];
            let inner = chain.at(-1);
            if (outer.parentElement === p) { p.insertBefore(node, outer); outer.remove() }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: els.map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  unwrap: {
    description: `Unwraps selected element(s), promoting children to their level`,
    shortcut: 'W',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selection to unwrap (defaults to master)` },
        i: { type: 'number', description: `How many unwraps (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'unwrap', cur, i });
      let frame = state.designer.current;
      let wrappers = frame.cursors[cur].map(id => frame.map.get(id)).filter(Boolean);
      let parents = wrappers.map(x => x.parentElement);
      let idxs = wrappers.map(x => [...x.parentElement.children].indexOf(x));
      let childLists = wrappers.map(x => [...x.childNodes]);
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = wrappers.length - 1; n >= 0; n--) {
            let wrapper = wrappers[n];
            let p = parents[n];
            let before = p.children[idxs[n]];
            for (let j = 0; j < i; j++) {
              if (!wrapper || !wrapper.parentElement) break;
              let children = [...wrapper.childNodes];
              for (let c of children) p.insertBefore(c, before);
              wrapper.remove();
              wrapper = p.children[idxs[n]];
            }
          }
          await new Promise(pres => setTimeout(pres));
          let promoted = [];
          for (let list of childLists) promoted.push(...list.filter(x => x.parentElement));
          await actions.changeSelection.handler({ cur, s: promoted.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < wrappers.length; n++) {
            let wrapper = wrappers[n];
            let p = parents[n];
            let i = idxs[n];
            let before = p.children[i];
            if (!before) p.appendChild(wrapper); else p.insertBefore(wrapper, before);
            for (let c of childLists[n]) wrapper.appendChild(c);
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: wrappers.map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  addCssClasses: {
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selection to use (defaults to master)` },
        cls: { type: 'array', items: { type: 'string' } },
      },
      required: ['cls'],
    },
    handler: async ({ cur = 'master', cls } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'addCssClasses', cur, cls });
      let frame = state.designer.current;
      cls = new Set(Array.isArray(cls) ? cls : cls.split(/\s+/));
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      await post('designer.pushHistory', 'master', async apply => {
        if (apply) for (let x of targets) for (let y of cls) x.classList.add(y);
        else for (let x of targets) for (let y of cls) x.classList.remove(y);
        await post('collab.sync');
      });
    },
  },

  removeCssClasses: {
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selection to use (defaults to master)` },
        cls: { type: 'array', items: { type: 'string' } },
      },
      required: ['cls'],
    },
    handler: async ({ cur = 'master', cls } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'removeCssClasses', cur, cls });
      let frame = state.designer.current;
      cls = new Set(Array.isArray(cls) ? cls : cls.split(/\s+/));
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      await post('designer.pushHistory', cur, async apply => {
        if (apply) for (let x of targets) for (let y of cls) x.classList.remove(y);
        else for (let x of targets) for (let y of cls) x.classList.add(y);
        await post('collab.sync');
      });
    },
  },

  replaceCssClasses: {
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selection to use (defaults to master)` },
        old: { type: 'array', items: { type: 'string' } },
        cls: { type: 'array', items: { type: 'string' } },
      },
      required: ['cls'],
    },
    handler: async ({ cur = 'master', old, cls } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'replaceCssClasses', cur, old, cls });
      let frame = state.designer.current;
      old = new Set(Array.isArray(old) ? old : old?.split(/\s+/) || []);
      cls = new Set(Array.isArray(cls) ? cls : cls.split(/\s+/));
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let x of targets) {
            for (let y of old) x.classList.remove(y);
            for (let y of cls) x.classList.add(y);
          }
        } else {
          for (let x of targets) {
            for (let y of cls) x.classList.remove(y);
            for (let y of old) x.classList.add(y);
          }
        }
        await post('collab.sync');
      });
    },
  },

  changeHtml: {
    description: `Changes the outer HTML of selected elements (prompts if not provided)`,
    shortcut: 'm',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selected elements to change (defaults to master)` },
        html: { type: 'string', description: `Keep original CSS classes and attributes unless they conflict with the requested HTML changes.` },
      },
    },
    handler: async ({ cur = 'master', html = null } = {}) => {
      let frame = state.designer.current;
      let replaced = [];
      let parents = [];
      let idxs = [];
      for (let el of frame.cursors[cur]) {
        el = frame.map.get(el);
        let p = el.parentElement;
        let i = [...p.children].indexOf(el);
        replaced.push(el);
        parents.push(p);
        idxs.push(i);
      }
      let order = replaced.map((el, n) => ({ el, p: parents[n], i: idxs[n], n }));
      order.sort((a, b) => {
        if (a.p === b.p) return a.i - b.i;
        return a.p.compareDocumentPosition(b.p) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      if (html == null) {
        let combined = order.map(o => {
          let clone = o.el.cloneNode(true);
          clone.removeAttribute('data-htmlsnap');
          clone.querySelectorAll('*').forEach(x => x.removeAttribute('data-htmlsnap'));
          return clone.outerHTML;
        }).join('\n');
        let [btn, val] = await showModal('CodeDialog', { title: 'Change HTML', initialValue: combined });
        if (btn !== 'ok') return;
        html = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeHtml', cur, html });
      let added = [];
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          let isBodyEdit = /^\s*<body[\s>]/i.test(html);
          let template = document.createElement('template');
          template.innerHTML = html;
          let newEls = [...template.content.children];
          let newSelect = [];
          added = [];
          let lastParent = parents.at(-1);
          let lastIndex = idxs.at(-1);
          for (let n = 0; n < replaced.length; n++) {
            let p = parents[n];
            let i = idxs[n];
            let newEl = newEls[order.findIndex(o => o.n === n)];
            let oldEl = p.children[i];
            if (!oldEl) continue;
            if (newEl) {
              if (oldEl.tagName === 'BODY') {
                if (isBodyEdit && newEl.tagName === 'BODY') {
                  for (let attr of [...newEl.attributes]) oldEl.setAttribute(attr.name, attr.value);
                  for (let attr of [...oldEl.attributes]) if (!newEl.hasAttribute(attr.name)) oldEl.removeAttribute(attr.name);
                  while (oldEl.firstChild) oldEl.removeChild(oldEl.firstChild);
                  for (let child of [...newEl.childNodes]) oldEl.appendChild(child.cloneNode(true));
                } else {
                  while (oldEl.firstChild) oldEl.removeChild(oldEl.firstChild);
                  for (let child of [...template.content.childNodes]) oldEl.appendChild(child.cloneNode(true));
                }
                newSelect.push(oldEl);
              } else if (['HTML','HEAD'].includes(oldEl.tagName)) {
                for (let attr of [...newEl.attributes]) oldEl.setAttribute(attr.name, attr.value);
                for (let attr of [...oldEl.attributes]) if (!newEl.hasAttribute(attr.name)) oldEl.removeAttribute(attr.name);
                newSelect.push(oldEl);
              } else {
                oldEl.replaceWith(newEl);
                newSelect.push(newEl);
              }
            } else {
              oldEl.remove();
            }
          }
          if (newEls.length > replaced.length) {
            let after = lastParent.children[lastIndex];
            let rest = newEls.slice(replaced.length);
            for (let el of rest) {
              if (after?.nextSibling) after.parentElement.insertBefore(el, after.nextSibling);
              else after?.parentElement.appendChild(el);
              newSelect.push(el);
              added.push(el);
              after = el;
            }
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: newSelect.map(x => frame.map.getKey(x)) });
        } else {
          let newSelect = [];
          for (let el of added) el.remove();
          for (let n = 0; n < replaced.length; n++) {
            let p = parents[n];
            let i = idxs[n];
            let current = p.children[i];
            if (current) current.replaceWith(replaced[n]);
            else {
              if (p.children[i - 1]) p.children[i - 1].after(replaced[n]);
              else p.insertBefore(replaced[n], p.firstChild);
            }
            newSelect.push(replaced[n]);
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: newSelect.map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  changeInnerHtml: {
    description: `Changes the inner HTML of selected elements (prompts if not provided)`,
    shortcut: 'M',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && state.designer.current.cursors[cur]?.length !== 1 && `A single element must be selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selected elements to change (defaults to master)` },
        html: { type: 'string' },
      },
    },
    handler: async ({ cur = 'master', html = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      let prev = targets.map(x => x.innerHTML);
      if (html == null) {
        let [btn, val] = await showModal('CodeDialog', { title: 'Change HTML (inner)', initialValue: prev.join('\n') });
        if (btn !== 'ok') return;
        html = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeInnerHtml', cur, html });
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) targets[n].innerHTML = apply ? html : prev[n];
        await actions.changeSelection.handler({ cur, s: targets.map(x => frame.map.getKey(x)) });
      });
    },
  },

  changeInputPlaceholder: {
    shortcut: 'Ctrl-p',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selected elements to change (defaults to master)` },
        placeholder: { type: 'string', description: `Placeholder text (default prompts user)` },
      },
    },
    handler: async ({ cur = 'master', placeholder = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(x => /^HTML(InputElement|TextAreaElement)$/.test(x.constructor.name));
      if (!targets.length) return;
      let prev = targets.map(x => x.placeholder);
      if (placeholder == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change input placeholder', label: 'Placeholder text', initialValue: prev[0] });
        if (btn !== 'ok') return;
        placeholder = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeInputPlaceholder', cur, placeholder });
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) {
          let nv = apply ? placeholder : prev[n];
          nv ? targets[n].setAttribute('placeholder', nv) : targets[n].removeAttribute('placeholder');
        }
      });
    },
  },

  changeFormMethod: {
    description: `Changes a form element's method attribute`,
    shortcut: 'Ctrl-M',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `whose selected elements to change (defaults to master)` },
        method: { type: 'string', description: `Method to use (default prompts user)` },
      },
    },
    handler: async ({ cur = 'master', method } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(x => x?.tagName === 'FORM');
      let prev = targets.map(x => x.getAttribute('method'));
      if (method == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change form method', label: 'Method', initialValue: prev[0] });
        if (btn !== 'ok') return;
        method = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeFormMethod', cur, method });
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) {
          let nv = apply ? method : prev[n];
          nv ? targets[n].setAttribute('method', nv) : targets[n].removeAttribute('method');
        }
      });
    },
  },

  toggleHidden: {
    description: `Toggles visibility of selected elements (via hidden attribute)`,
    shortcut: 'x',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selected elements to toggle (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'toggleHidden', cur });
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      let prev = targets.map(x => x.hidden);
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) targets[n].hidden = apply ? !prev[n] : prev[n];
      });
    },
  },

  replaceTextContent: {
    description: `If no text is provided, a single-line input modal is shown`,
    shortcut: 't',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to move (defaults to master)` },
        text: { type: 'string', description: `Replacement text (defaults to a modal to prompt the user)` },
      },
    },
    handler: async ({ cur = 'master', text } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      let prev = targets.map(x => x.textContent);
      if (text == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Replace text', label: 'Text', initialValue: prev[0] });
        if (btn !== 'ok') return;
        text = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'replaceTextContent', cur, text });
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) targets[n].textContent = apply ? text : prev[n];
      });
    },
  },

  replaceMultilineTextContent: {
    description: `Replaces the selected element's content with multiline input; prompts textarea if no text is provided`,
    shortcut: 'T',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
        text: { type: 'string', description: `Replacement text (defaults to multiline textarea prompt)` },
      },
    },
    handler: async ({ cur = 'master', text } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      let prev = targets.map(x => x.textContent);
      if (text == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Replace text (multiline)', label: 'Text', initialValue: prev.join('\n'), multiline: true });
        if (btn !== 'ok') return;
        text = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'replaceMultilineTextContent', cur, text });
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) targets[n].textContent = apply ? text : prev[n];
      });
    },
  },

  changeLinkUrl: {
    shortcut: 'H',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
        url: { type: 'string', description: `Link URL (default prompts user)` },
      },
    },
    handler: async ({ cur = 'master', url } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean).filter(x => x.tagName === 'A');
      let prev = targets.map(x => x.getAttribute('href'));
      if (url == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change link URL', label: 'URL', initialValue: prev[0] });
        if (btn !== 'ok') return;
        url = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeLinkUrl', cur, url });
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) {
          let nv = apply ? url : prev[n];
          nv ? targets[n].setAttribute('href', nv) : targets[n].removeAttribute('href');
        }
      });
    },
  },

  changeMediaSrc: {
    shortcut: 's',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
        url: { type: 'string', description: `Link URL (default prompts user)` },
      },
    },
    handler: async ({ cur = 'master', url } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prevSrcs = targets.map(x => x.getAttribute('src'));
      let prevTags = targets.map(x => x.tagName.toLowerCase());
      if (url == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change media source', label: 'URL', initialValue: prevSrcs[0] });
        if (btn !== 'ok') return;
        url = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeMediaSrc', cur, url });
      let mime = mimeLookup(url);
      let newTag = mime?.startsWith?.('audio/') ? 'audio' : mime?.startsWith?.('video/') ? 'video' : 'img';
      let parents = targets.map(x => x.parentElement);
      let idxs = targets.map(x => [...x.parentElement.children].indexOf(x));
      let oldEls = targets.map(x => x);
      let newEls = targets.map((el, n) => {
        let tag = newTag && newTag !== el.tagName.toLowerCase() ? newTag : el.tagName.toLowerCase();
        if (tag === el.tagName.toLowerCase()) return el;
        let clone = document.createElement(tag);
        for (let attr of el.attributes) clone.setAttribute(attr.name, attr.value);
        clone.innerHTML = el.innerHTML;
        return clone;
      });
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < oldEls.length; n++) {
            let el = oldEls[n];
            let p = parents[n];
            let i = idxs[n];
            let repl = newEls[n];
            if (repl !== el) {
              if (p.children[i] === el) p.replaceChild(repl, el);
              else p.insertBefore(repl, p.children[i]);
            }
            let nv = url;
            nv ? repl.setAttribute('src', nv) : repl.removeAttribute('src');
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: newEls.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < oldEls.length; n++) {
            let el = oldEls[n];
            let p = parents[n];
            let i = idxs[n];
            let repl = newEls[n];
            if (repl !== el) {
              if (p.children[i] === repl) p.replaceChild(el, repl);
              else p.insertBefore(el, p.children[i]);
            }
            let pv = prevSrcs[n];
            pv ? el.setAttribute('src', pv) : el.removeAttribute('src');
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: oldEls.map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  // TODO: Test if possible to create a "list gallery media" function and reply using the success object in a usable way.
  changeMediaSrcFromGallery: {
    shortcut: 'S',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      let frame = state.designer.current;
      let [btn, url] = await showModal('MediaGalleryDialog');
      if (btn !== 'ok') return;
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeMediaSrc', cur, url });
      let mime = mimeLookup(url);
      let newTag = mime?.startsWith?.('audio/') ? 'audio' : mime?.startsWith?.('video/') ? 'video' : 'img';
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let parents = targets.map(x => x.parentElement);
      let idxs = targets.map(x => [...x.parentElement.children].indexOf(x));
      let prevSrcs = targets.map(x => x.getAttribute('src'));
      let prevTags = targets.map(x => x.tagName.toLowerCase());
      let oldEls = targets.map(x => x);
      let newEls = targets.map((el, n) => {
        let tag = newTag && newTag !== el.tagName.toLowerCase() ? newTag : el.tagName.toLowerCase();
        if (tag === el.tagName.toLowerCase()) return el;
        let clone = document.createElement(tag);
        for (let attr of el.attributes) clone.setAttribute(attr.name, attr.value);
        clone.innerHTML = el.innerHTML;
        return clone;
      });
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          for (let n = 0; n < oldEls.length; n++) {
            let el = oldEls[n];
            let p = parents[n];
            let i = idxs[n];
            let repl = newEls[n];
            if (repl !== el) {
              if (p.children[i] === el) p.replaceChild(repl, el);
              else p.insertBefore(repl, p.children[i]);
            }
            url ? repl.setAttribute('src', url) : repl.removeAttribute('src');
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: newEls.map(x => frame.map.getKey(x)) });
        } else {
          for (let n = 0; n < oldEls.length; n++) {
            let el = oldEls[n];
            let p = parents[n];
            let i = idxs[n];
            let repl = newEls[n];
            if (repl !== el) {
              if (p.children[i] === repl) p.replaceChild(el, repl);
              else p.insertBefore(el, p.children[i]);
            }
            let pv = prevSrcs[n];
            pv ? el.setAttribute('src', pv) : el.removeAttribute('src');
          }
          await new Promise(pres => setTimeout(pres));
          await actions.changeSelection.handler({ cur, s: oldEls.map(x => frame.map.getKey(x)) });
        }
      });
    },
  },

  changeBackgroundUrl: {
    shortcut: 'b',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
        url: { type: 'string', description: `Link URL (default prompts user)` },
      },
    },
    handler: async ({ cur = 'master', url = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.style.backgroundImage);
      if (url == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change background image', label: 'Image URL', initialValue: prev[0]?.replace(/^url\("|"\)$/g, '') });
        if (btn !== 'ok') return;
        url = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeBackgroundUrl', cur, url });
      let newBg = url ? `url("${url}")` : '';
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) {
          let x = targets[n];
          x.style.backgroundImage = apply ? newBg : prev[n];
        }
        await new Promise(pres => setTimeout(pres));
        await actions.changeSelection.handler({ cur, s: targets.map(x => frame.map.getKey(x)) });
      });
    },
  },

  changeBackgroundFromGallery: {
    shortcut: 'B',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      let frame = state.designer.current;
      let [btn, url] = await showModal('MediaGalleryDialog');
      if (btn !== 'ok') return;
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeBackgroundUrl', cur, url });
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.style.backgroundImage);
      let newBg = url ? `url("${url}")` : '';
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) { let x = targets[n]; x.style.backgroundImage = apply ? newBg : prev[n] }
        await new Promise(pres => setTimeout(pres));
        await actions.changeSelection.handler({ cur, s: targets.map(x => frame.map.getKey(x)) });
      });
    },
  },

  setIfExpression: {
    description: `Sets conditional expression for displaying elements (prompts if not provided)`,
    shortcut: 'Ctrl-i',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string' },
        expr: { type: 'string' },
      },
    },
    handler: async ({ cur = 'master', expr = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (expr == null) {
        let initial = targets[0].getAttribute('wf-if');
        let [btn, val] = await showModal('PromptDialog', {
          title: 'Set if expression',
          placeholder: 'Expression',
          initialValue: initial,
        });
        if (btn !== 'ok') return;
        expr = val.trim();
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'setIfExpression', cur, expr });
      let prev = targets.map(x => x.getAttribute('wf-if'));
      let newVal = expr;
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) {
          let el = targets[n];
          let nv = apply ? newVal : prev[n];
          nv ? el.setAttribute('wf-if', nv) : el.removeAttribute('wf-if');
        }
        await new Promise(pres => setTimeout(pres));
        await actions.changeSelection.handler({ cur, s: targets.map(x => frame.map.getKey(x)) });
      });
    },
  },

  setMapExpression: {
    description: `Sets map expression for repeating elements (prompts if not provided)`,
    shortcut: 'Ctrl-m',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string' },
        expr: { type: 'string', description: `Format: x of xs` },
      },
    },
    handler: async ({ cur = 'master', expr = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (expr == null) {
        let initial = targets[0].getAttribute('wf-map');
        let [btn, val] = await showModal('PromptDialog', {
          title: 'Set map expression',
          placeholder: 'Expression (item of expr)',
          initialValue: initial,
        });
        if (btn !== 'ok') return;
        expr = val.trim();
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'setMapExpression', cur, expr });
      let prev = targets.map(x => x.getAttribute('wf-map'));
      let newVal = expr;
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) {
          let el = targets[n];
          let nv = apply ? newVal : prev[n];
          nv ? el.setAttribute('wf-map', nv) : el.removeAttribute('wf-map');
        }
        await new Promise(pres => setTimeout(pres));
        await actions.changeSelection.handler({ cur, s: targets.map(x => frame.map.getKey(x)) });
      });
    },
  },

  setEventHandlers: {
    shortcut: 'Ctrl-o',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && state.designer.current.cursors[cur]?.length !== 1 && `A single element must be selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master', handlers } = {}) => {
      let frame = state.designer.current;
      let el = frame.map.get(frame.cursors[cur][0]);
      if (!el) return;
      let prevHandlers = [];
      for (let attr of el.attributes) if (attr.name.startsWith('wf-on')) prevHandlers.push({ name: attr.name.slice(5), expr: attr.value });
      if (!handlers) {
        let [btn, ...val] = await showModal('EventHandlersDialog', { handlers: prevHandlers });
        if (btn !== 'ok') return;
        handlers = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'setEventHandlers', cur, handlers });
      let newHandlers = Array.isArray(handlers) ? handlers.filter(h => h && h.name && h.expr) : [];
      let prev = Array.isArray(prevHandlers) ? prevHandlers : [];
      let next = newHandlers.length ? newHandlers : prev;
      await post('designer.pushHistory', cur, async apply => {
        let list = apply ? next : prev;
        for (let attr of [...el.attributes]) if (attr.name.startsWith('wf-on')) el.removeAttribute(attr.name);
        for (let h of list) if (h.name && h.expr) el.setAttribute(`wf-on${h.name}`, h.expr);
      });
    },
  },

  setDisabledExpression: {
    shortcut: 'Ctrl-D',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
        expr: { type: 'string', description: `Expression to bind to the disabled attribute (optional, prompts if not provided)` },
      },
    },
    handler: async ({ cur = 'master', expr = null } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'setDisabledExpression', cur, expr });
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (expr == null) {
        let initial = targets[0].getAttribute('wf-disabled');
        let [btn, val] = await showModal('PromptDialog', { title: 'Set disabled expression', placeholder: 'Expression (e.g. !form.valid)', initialValue: initial });
        if (btn !== 'ok') return;
        expr = val.trim();
      }
      let prev = targets.map(x => x.getAttribute('wf-disabled'));
      let newVal = expr;
      await post('designer.pushHistory', cur, async apply => {
        for (let n = 0; n < targets.length; n++) {
          let el = targets[n];
          let nv = apply ? newVal : prev[n];
          nv ? el.setAttribute('wf-disabled', nv) : el.removeAttribute('wf-disabled');
        }
        await new Promise(pres => setTimeout(pres));
        await actions.changeSelection.handler({ cur, s: targets.map(x => frame.map.getKey(x)) });
      });
    },
  },

  normalizeStylesUnion: {
    description: `Makes all selected elements have the union of their classes (confirm union is what the user wants before calling)`,
    shortcut: 'Alt-u',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && (state.designer.current.cursors[cur]?.length || 0) < 2 && `At least 2 elements must be selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'normalizeStylesUnion', cur });
      let frame = state.designer.current;
      let all = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!all.length) return;
      let prev = all.map(x => x.className);
      let union = new Set();
      for (let el of all) for (let c of el.classList) union.add(c);
      let merged = [...union].join(' ').trim();
      await post('designer.pushHistory', cur, async apply => {
        for (let i = 0; i < all.length; i++) all[i].className = apply ? merged : prev[i];
      });
    },
  },

  normalizeStylesIntersect: {
    description: `Makes all selected elements have the intersection of their classes (confirm intersection is what the user wants before calling)`,
    shortcut: 'Alt-U',
    disabled: ({ cur = 'master' }) => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && (state.designer.current.cursors[cur]?.length || 0) < 2 && `At least 2 elements must be selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose cursor to use (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'normalizeStylesIntersect', cur });
      let frame = state.designer.current;
      let all = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!all.length) return;
      let prev = all.map(x => x.className);
      let intersection = new Set(all[0].classList);
      for (let i = 1; i < all.length; i++) for (let c of [...intersection]) if (!all[i].classList.contains(c)) intersection.delete(c);
      let merged = [...intersection].join(' ').trim();
      await post('designer.pushHistory', cur, async apply => {
        for (let i = 0; i < all.length; i++) all[i].className = apply ? merged : prev[i];
      });
    },
  },

  refresh: {
    shortcut: 'r',
    disabled: () => [!state.designer.open && `Designer closed.`],
    handler: async () => {
      if (state.collab.uid !== 'master') return;
      await post('designer.refresh');
    },
  },
};

export default actions;
