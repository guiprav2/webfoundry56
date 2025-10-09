let actions = {
  undo: {
    shortcut: 'Ctrl-z',
    condition: () => state.designer.open,
    negativeReason: () => [!state.designer.open && `Designer closed.`],
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
    condition: () => state.designer.open,
    negativeReason: () => [!state.designer.open && `Designer closed.`],
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
    condition: () => state.designer.open,
    negativeReason: `Designer closed.`,
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
    condition: () => state.designer.open,
    negativeReason: `Designer closed.`,
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.cursors[cur]?.length && `No elements selected.`,
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      state.designer.open && !state.designer.cursors[cur]?.length && `No elements selected.`,
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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

  copySelected: {
    description: `Copies currently selected element(s)`,
    shortcut: 'c',
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.current.cursors[cur]?.length && `No elements selected.`,
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
      frame.clipboards[cur] = html;
      cur === 'master' && localStorage.setItem('webfoundry:clipboard', html);
    },
  },

  deleteSelected: {
    description: `Deletes and copies currently selected element(s)`,
    shortcut: 'd',
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
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
      let html = frame.clipboards[cur] || (cur === 'master' && localStorage.getItem('webfoundry:clipboard'));
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
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
      let html = frame.clipboards[cur] || (cur === 'master' && localStorage.getItem('webfoundry:clipboard'));
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
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
      let html = frame.clipboards[cur] || (cur === 'master' && localStorage.getItem('webfoundry:clipboard'));
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
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
      let html = frame.clipboards[cur] || (cur === 'master' && localStorage.getItem('webfoundry:clipboard'));
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
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose selection to wrap (defaults to master)`,
        },
        tag: {
          type: 'string',
          description: `Tag to wrap with (defaults to div)`,
        },
      },
    },
    handler: async ({ cur = 'master', tag = 'div' } = {}) =>
      await post('designer.wrap', cur, tag),
  },

  unwrap: {
    description: `Unwraps selected element(s), promoting children to their level`,
    shortcut: 'W',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose selection to unwrap (defaults to master)`,
        },
      },
    },
    handler: async ({ cur = 'master' } = {}) =>
      await post('designer.unwrap', cur),
  },

  addCssClasses: {
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
      let targets = frame.cursors.master.map(x => frame.map.get(x)).filter(Boolean);
      await post('designer.pushHistory', 'master', async apply => {
        if (apply) for (let x of targets) for (let y of cls) x.classList.remove(y);
        else for (let x of targets) for (let y of cls) x.classList.add(y);
        await post('collab.sync');
      });
    },
  },

  replaceCssClasses: {
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
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
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.current.cursors[cur]?.length && `No elements selected`,
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
      if (html == null) {
        let combined = replaced.map(el => {
          let clone = el.cloneNode(true);
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
            let newEl = newEls[n];
            if (newEl) {
              p.children[i].replaceWith(newEl);
              newSelect.push(newEl);
            } else {
              p.children[i]?.remove();
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
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `whose selected elements to change (defaults to master)`,
        },
        html: { type: 'string' },
      },
    },
    handler: async ({ cur = 'master', html } = {}) =>
      await post('designer.changeInnerHtml', cur, html),
  },

  changeInputPlaceholder: {
    shortcut: 'Ctrl-p',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `whose selected elements to change (defaults to master)`,
        },
        placeholder: {
          type: 'string',
          description: `Placeholder text (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', placeholder } = {}) =>
      await post('designer.changeInputPlaceholder', cur, placeholder),
  },

  changeFormMethod: {
    description: `Changes a form element's method attribute`,
    shortcut: 'Ctrl-M',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `whose selected elements to change (defaults to master)`,
        },
        method: {
          type: 'string',
          description: `Method to use (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', method } = {}) =>
      await post('designer.changeFormMethod', cur, method),
  },

  toggleHidden: {
    description: `Toggles visibility of selected elements (via hidden attribute)`,
    shortcut: 'x',
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.current.cursors[cur]?.length && `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Whose selected elements to toggle (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => await post('designer.toggleHidden', cur),
  },

  replaceTextContent: {
    description: `If no text is provided, a single-line input modal is shown`,
    shortcut: 't',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      state.designer.open &&
        !state.designer.cursors[cur]?.length &&
        `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to move (defaults to master)`,
        },
        text: {
          type: 'string',
          description: `Replacement text (defaults to a modal to prompt the user)`,
        },
      },
    },
    handler: async ({ cur = 'master', text } = {}) =>
      await post('designer.replaceTextContent', cur, text),
  },

  replaceMultilineTextContent: {
    description: `Replaces the selected element's content with multiline input; prompts textarea if no text is provided`,
    shortcut: 'T',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
        text: {
          type: 'string',
          description: `Replacement text (defaults to multiline textarea prompt)`,
        },
      },
    },
    handler: async ({ cur = 'master', text } = {}) =>
      await post('designer.replaceMultilineTextContent', cur, text),
  },

  changeLinkUrl: {
    shortcut: 'H',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
        url: {
          type: 'string',
          description: `Link URL (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', url } = {}) =>
      await post('designer.changeLinkUrl', cur, url),
  },

  changeMediaSrc: {
    shortcut: 's',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
        url: {
          type: 'string',
          description: `Link URL (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', url } = {}) =>
      await post('designer.changeMediaSrc', cur, url),
  },

  // FIXME: Test if possible to create a "list gallery media" function and reply
  // using the success object in a usable way. Probably not but worth trying.

  changeMediaSrcFromGallery: {
    shortcut: 'S',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
        url: {
          type: 'string',
          description: `Gallery media URL if known (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', url } = {}) =>
      await post('designer.changeMediaFromGallery', cur, url),
  },

  changeBackgroundUrl: {
    shortcut: 'b',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
        url: {
          type: 'string',
          description: `Link URL (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', url } = {}) =>
      await post('designer.changeBackgroundUrl', cur, url),
  },

  changeBackgroundFromGallery: {
    shortcut: 'B',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
        url: {
          type: 'string',
          description: `Gallery media URL if known (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', url } = {}) =>
      await post('designer.changeBackgroundFromGallery', cur, url),
  },

  setIfExpression: {
    description: `Sets conditional expression for displaying elements (prompts if not provided)`,
    shortcut: 'Ctrl-i',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string' },
        expr: { type: 'string' },
      },
    },
    handler: async ({ cur = 'master', expr } = {}) =>
      await post('designer.setIfExpression', cur, expr),
  },

  setMapExpression: {
    description: `Sets map expression for repeating elements (prompts if not provided)`,
    shortcut: 'Ctrl-m',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string' },
        mapExpr: { type: 'string', description: `Format: x of xs` },
      },
    },
    handler: async ({ cur = 'master', mapExpr } = {}) =>
      await post('designer.setMapExpression', cur, mapExpr),
  },

  // FIXME: Support multiple selections like in the Styles panel
  setEventHandlers: {
    shortcut: 'Ctrl-o',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length === 1,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      state.designer.cursors[cur]?.length !== 1 &&
        `A single element must be selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
      },
    },
    handler: async ({ cur = 'master' } = {}) =>
      await post('designer.setEventHandlers', cur),
  },

  setDisabledExpression: {
    shortcut: 'Ctrl-D',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      !state.designer.cursors[cur]?.length && `No elements selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose cursor to use (defaults to master)`,
        },
      },
    },
    handler: async ({ cur = 'master', mapExpr } = {}) =>
      await post('designer.setDisabledExpression', cur, mapExpr),
  },

  refreshPage: {
    condition: () => state.designer.open,
    negativeReason: `Designer closed.`,
    handler: async () => await post('designer.refresh'),
  },
};

export default actions;
