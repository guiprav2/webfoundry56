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
      },
    },
    handler: async ({ cur = 'master' } = {}) => await post('designer.pasteNextSibling', cur),
  },

  pastePrevSibling: {
    description: `Pastes copied elements as the previous sibling`,
    shortcut: 'P',
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Target cursor for paste (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => await post('designer.pastePrevSibling', cur),
  },

  pasteLastChild: {
    description: `Pastes copied elements as the last child`,
    shortcut: 'o',
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Target cursor for paste (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => await post('designer.pasteLastChild', cur),
  },

  pasteFirstChild: {
    description: `Pastes copied elements as the first child`,
    shortcut: 'O',
    condition: (cur = 'master') => state.designer.open && state.designer.current.cursors[cur]?.length,
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Target cursor for paste (defaults to master)` },
      },
    },
    handler: async ({ cur = 'master' } = {}) => await post('designer.pasteFirstChild', cur),
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
          description: `Whose selection to use (defaults to master)`,
        },
        framework: {
          type: 'string',
          enum: ['tw', 'bs', 'bu', 'none'],
          description: `Use tw for Tailwind classes, bs for Bootstrap, and bu for Bulma`,
        },
        classes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['framework', 'classes'],
    },
    handler: async ({ cur = 'master', framework, classes } = {}) =>
      await post(
        'designer.addCssClasses',
        cur,
        framework === 'none' ? classes : [framework, ...classes],
      ),
  },

  removeCssClasses: {
    description: [
      `If no Tailwind classes are left, always remove "tw" as well.`,
      `If no Bootstrap classes are left, always remove "bs" as well.`,
      `If no Bulma classes are left, always remove "bu" as well.`,
    ].join('\n'),
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
          description: `Whose selection to use (defaults to master)`,
        },
        classes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['classes'],
    },
    handler: async ({ cur = 'master', classes } = {}) =>
      await post('designer.removeCssClasses', cur, classes),
  },

  normalizeStylesUnion: {
    description: `Makes all selected elements have the union of their classes (confirm union is what the user wants before calling)`,
    shortcut: 'Ctrl-u',
    condition: (cur = 'master') =>
      state.designer.open && (state.designer.cursors[cur]?.length || 0 < 2),
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      (state.designer.cursors[cur]?.length || 0 < 2) &&
        `At least 2 elements must be selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string' },
      },
    },
    handler: async ({ cur = 'master' } = {}) =>
      await post('designer.normalizeStylesUnion', cur),
  },

  normalizeStylesIntersect: {
    description: `Makes all selected elements have the intersection of their classes (confirm intersection is what the user wants before calling)`,
    shortcut: 'Ctrl-U',
    condition: (cur = 'master') =>
      state.designer.open && (state.designer.cursors[cur]?.length || 0 < 2),
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      (state.designer.cursors[cur]?.length || 0 < 2) &&
        `At least 2 elements must be selected`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string' },
      },
    },
    handler: async ({ cur = 'master' } = {}) =>
      await post('designer.normalizeStylesIntersect', cur),
  },

  changeElementId: {
    shortcut: 'Ctrl-I',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length === 1,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      state.designer.open &&
        !state.designer.cursors[cur]?.length &&
        `A single element must be selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose selection to use (defaults to master)`,
        },
        id: {
          type: 'string',
          description: `New ID (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', id } = {}) =>
      await post('designer.changeElementId', cur, id),
  },

  changeElementTag: {
    shortcut: 'e',
    condition: (cur = 'master') =>
      state.designer.open && state.designer.cursors[cur]?.length,
    negativeReason: (cur = 'master') => [
      !state.designer.open && `Designer closed.`,
      state.designer.open &&
        !state.designer.cursors[cur]?.length &&
        `No elements selected.`,
    ],
    parameters: {
      type: 'object',
      properties: {
        cur: {
          type: 'string',
          description: `Whose selection to use (defaults to master)`,
        },
        tag: {
          type: 'string',
          description: `New tag name (default prompts user)`,
        },
      },
    },
    handler: async ({ cur = 'master', tag } = {}) =>
      await post('designer.changeElementTag', cur, tag),
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
    handler: async ({ cur = 'master', html } = {}) => await post('designer.changeHtml', cur, html),
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
