import { lookup as mimeLookup } from 'https://esm.sh/mrmime';

let actions = {
  undo: {
    shortcut: ['Ctrl-z', 'z'],
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
    shortcut: ['Ctrl-y', 'y'],
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
      if (state.collab.uid === cur) await post('designer.toggleMobileKeyboard');
      if (state.collab.uid === cur && s.length) {
        let first = frame.map.get(s[0]);
        let rect = first.getBoundingClientRect();
        let visible = rect.top >= 20 && rect.bottom <= innerHeight - 20;
        !visible && first.scrollIntoView({ block: rect.height <= innerHeight ? 'center' : 'nearest', inline: rect.width <= innerWidth ? 'center' : 'nearest' });
      }
      await post('designer.sync');
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
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'number', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createNextSibling', cur, tag, i });
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let ref = frame.map.get(frame.cursors[cur][0]);
      if (!ref || ref.tagName === 'BODY') return;
      let refKey = frame.map.getKey(ref);
      let createdKeys = [];

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !createdKeys.length) {
          createdKeys = await ifeval(async ({ args }) => {
            let ref = state.map.get(args.refKey);
            if (!ref) return [];
            let made = [];
            for (let n = 0; n < args.count; n++) {
              let el = document.createElement(args.tag);
              ref.insertAdjacentElement('afterend', el);
              made.push(el);
            }
            await new Promise(pres => setTimeout(pres));
            return made.map(x => state.map.getKey(x));
          }, { refKey, tag, count: i });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            let ref = state.map.get(args.refKey);
            if (!ref) return;
            for (let id of args.createdKeys) {
              let el = state.map.get(id);
              if (el) ref.insertAdjacentElement('afterend', el);
            }
          }, { refKey, createdKeys });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else {
          await ifeval(({ args }) => { for (let id of args.createdKeys) state.map.get(id)?.remove(); }, { createdKeys });
          await actions.changeSelection.handler({ cur, s: [refKey] });
        }
      });
    },
  },

  createPrevSibling: {
    shortcut: 'A',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'number', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createPrevSibling', cur, tag, i });
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let ref = frame.map.get(frame.cursors[cur][0]);
      if (!ref || ref.tagName === 'BODY') return;
      let refKey = frame.map.getKey(ref);
      let createdKeys = [];

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !createdKeys.length) {
          createdKeys = await ifeval(async ({ args }) => {
            let ref = state.map.get(args.refKey);
            if (!ref) return [];
            let made = [];
            for (let n = 0; n < args.count; n++) {
              let el = document.createElement(args.tag);
              ref.insertAdjacentElement('beforebegin', el);
              made.push(el);
            }
            await new Promise(pres => setTimeout(pres));
            return made.map(x => state.map.getKey(x));
          }, { refKey, tag, count: i });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            let ref = state.map.get(args.refKey);
            if (!ref) return;
            for (let id of args.createdKeys) {
              let el = state.map.get(id);
              if (el) ref.insertAdjacentElement('beforebegin', el);
            }
          }, { refKey, createdKeys });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else {
          await ifeval(({ args }) => { for (let id of args.createdKeys) state.map.get(id)?.remove(); }, { createdKeys });
          await actions.changeSelection.handler({ cur, s: [refKey] });
        }
      });
    },
  },

  createLastChild: {
    shortcut: 'i',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'number', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createLastChild', cur, tag, i });
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let parent = frame.map.get(frame.cursors[cur][0]);
      if (!parent) return;
      let parentKey = frame.map.getKey(parent);
      let createdKeys = [];

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !createdKeys.length) {
          createdKeys = await ifeval(async ({ args }) => {
            let parent = state.map.get(args.parentKey);
            if (!parent) return [];
            let made = [];
            for (let n = 0; n < args.count; n++) {
              let el = document.createElement(args.tag);
              parent.insertAdjacentElement('beforeend', el);
              made.push(el);
            }
            await new Promise(pres => setTimeout(pres));
            return made.map(x => state.map.getKey(x));
          }, { parentKey, tag, count: i });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            let parent = state.map.get(args.parentKey);
            if (!parent) return;
            for (let id of args.createdKeys) {
              let el = state.map.get(id);
              if (el) parent.insertAdjacentElement('beforeend', el);
            }
          }, { parentKey, createdKeys });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else {
          await ifeval(({ args }) => { for (let id of args.createdKeys) state.map.get(id)?.remove(); }, { createdKeys });
          await actions.changeSelection.handler({ cur, s: [parentKey] });
        }
      });
    },
  },

  createFirstChild: {
    shortcut: 'I',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: {
      type: 'object',
      properties: {
        cur: { type: 'string', description: `Relative to whose cursor (defaults to master)` },
        tag: { type: 'string', description: `Tag name to create (defaults to div)` },
        i: { type: 'number', description: `How many to create (defaults to 1)` },
      },
    },
    handler: async ({ cur = 'master', tag = 'div', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'createFirstChild', cur, tag, i });
      let frame = state.designer.current;
      if (frame.cursors[cur].length !== 1) return;
      let parent = frame.map.get(frame.cursors[cur][0]);
      if (!parent) return;
      let parentKey = frame.map.getKey(parent);
      let createdKeys = [];

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !createdKeys.length) {
          createdKeys = await ifeval(async ({ args }) => {
            let parent = state.map.get(args.parentKey);
            if (!parent) return [];
            let made = [];
            for (let n = 0; n < args.count; n++) {
              let el = document.createElement(args.tag);
              parent.insertAdjacentElement('afterbegin', el);
              made.push(el);
            }
            await new Promise(pres => setTimeout(pres));
            return made.map(x => state.map.getKey(x));
          }, { parentKey, tag, count: i });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            let parent = state.map.get(args.parentKey);
            if (!parent) return;
            for (let id of args.createdKeys) {
              let el = state.map.get(id);
              if (el) parent.insertAdjacentElement('afterbegin', el);
            }
          }, { parentKey, createdKeys });
          await actions.changeSelection.handler({ cur, s: createdKeys });
        } else {
          await ifeval(({ args }) => { for (let id of args.createdKeys) state.map.get(id)?.remove(); }, { createdKeys });
          await actions.changeSelection.handler({ cur, s: [parentKey] });
        }
      });
    },
  },

  changeElementTag: {
    shortcut: 'e',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
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

      let targetKeys = targets.map(x => frame.map.getKey(x));
      let parentKeys = targets.map(x => frame.map.getKey(x.parentElement));
      let idxs = targets.map(x => [...x.parentElement.children].indexOf(x));
      let newKeys = [];

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !newKeys.length) {
          newKeys = await ifeval(async ({ args }) => {
            let created = [];
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              if (!el || !p) continue;
              if (el.tagName.toLowerCase() === args.tag) {
                created.push(state.map.getKey(el));
                continue;
              }
              let clone = document.createElement(args.tag);
              for (let a of el.attributes) clone.setAttribute(a.name, a.value);
              clone.innerHTML = el.innerHTML;
              if (p.children[i] === el) p.replaceChild(clone, el);
              created.push(clone);
            }
            await new Promise(pres => setTimeout(pres));
            return created.map(x => state.map.getKey(x));
          }, { targets: targetKeys, parents: parentKeys, idxs, tag });
          await actions.changeSelection.handler({ cur, s: newKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              let clone = state.map.get(args.newKeys[n]);
              if (!el || !p || !clone) continue;
              if (p.children[i] === el && el.tagName.toLowerCase() !== clone.tagName.toLowerCase()) p.replaceChild(clone, el);
            }
          }, { targets: targetKeys, parents: parentKeys, idxs, newKeys });
          await actions.changeSelection.handler({ cur, s: newKeys });
        } else {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              let clone = state.map.get(args.newKeys[n]);
              if (!el || !p || !clone) continue;
              if (p.children[i] === clone && clone.tagName.toLowerCase() !== el.tagName.toLowerCase()) p.replaceChild(el, clone);
            }
          }, { targets: targetKeys, parents: parentKeys, idxs, newKeys });
          await actions.changeSelection.handler({ cur, s: targetKeys });
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
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'deleteSelected', cur, i });
      let frame = state.designer.current;
      await actions.copySelected.handler({ cur });
      while (i-- > 0) {
        let cursors = frame.cursors[cur];
        let ss = cursors.map(x => frame.map.get(x)).filter(x => x && x !== frame.root && x !== frame.body && x !== frame.head);
        if (!ss.length) return;
        let removedKeys = ss.map(x => frame.map.getKey(x));
        let parentKeys = ss.map(x => frame.map.getKey(x.parentElement));
        let idxs = ss.map(x => [...x.parentElement.children].indexOf(x));
        let selectKeys = [];
        await post('designer.pushHistory', cur, async apply => {
          if (apply && !selectKeys.length) {
            let result = await ifeval(async ({ args }) => {
              let select = new Set();
              let removed = [];
              for (let n = 0; n < args.removed.length; n++) {
                let el = state.map.get(args.removed[n]);
                let p = state.map.get(args.parents[n]);
                let idx = args.idxs[n];
                if (!el || !p) continue;
                removed.push(state.map.getKey(el));
                el.remove();
                let next = p.children[idx] || p.children[idx - 1];
                if (next && !args.removed.includes(state.map.getKey(next))) select.add(next);
                else select.add(p);
              }
              await new Promise(pres => setTimeout(pres));
              return { removed, select: [...select].map(x => state.map.getKey(x)) };
            }, { removed: removedKeys, parents: parentKeys, idxs });
            removedKeys = result.removed;
            selectKeys = result.select;
            await actions.changeSelection.handler({ cur, s: selectKeys });
          } else if (apply) {
            let result = await ifeval(async ({ args }) => {
              let select = new Set();
              for (let n = 0; n < args.removed.length; n++) {
                let el = state.map.get(args.removed[n]);
                let p = state.map.get(args.parents[n]);
                let idx = args.idxs[n];
                if (!el || !p) continue;
                el.remove();
                let next = p.children[idx] || p.children[idx - 1];
                if (next && !args.removed.includes(state.map.getKey(next))) select.add(next);
                else select.add(p);
              }
              await new Promise(pres => setTimeout(pres));
              return [...select].map(x => state.map.getKey(x));
            }, { removed: removedKeys, parents: parentKeys, idxs });
            selectKeys = result;
            await actions.changeSelection.handler({ cur, s: selectKeys });
          } else {
            await ifeval(({ args }) => {
              for (let n = 0; n < args.removed.length; n++) {
                let el = state.map.get(args.removed[n]);
                let p = state.map.get(args.parents[n]);
                let idx = args.idxs[n];
                if (!p || !el) continue;
                if (p.children[idx]) p.insertBefore(el, p.children[idx]);
                else p.appendChild(el);
              }
            }, { removed: removedKeys, parents: parentKeys, idxs });
            await actions.changeSelection.handler({ cur, s: removedKeys });
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
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pasteNextSibling', cur, i });
      let frame = state.designer.current;
      let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard');
      if (!html) return;
      let pos = 'afterend';
      let cursors = [...frame.cursors[cur] || []];
      if (!cursors.length) return;
      let cloneIds = [];
      await post('designer.pushHistory', cur, async apply => {
        if (apply && !cloneIds.length) {
          cloneIds = await ifeval(async ({ args }) => {
            let template = document.createElement('template');
            template.innerHTML = args.html;
            let frags = [...template.content.children];
            if (!frags.length) return [];
            let reversed = args.pos === 'afterbegin';
            let items = reversed ? [...args.cursors].reverse() : args.cursors;
            let added = [];
            for (let i = 0; i < items.length; i++) {
              let f = frags[i % frags.length].cloneNode(true);
              f.removeAttribute('data-htmlsnap');
              state.map.get(items[i]).insertAdjacentElement(args.pos, f);
              added.push(f);
            }
            await new Promise(pres => setTimeout(pres));
            return added.map(x => state.map.getKey(x));
          }, { html, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else if (apply) {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(args.cursors[0])?.insertAdjacentElement?.(args.pos, state.map.get(id)) }, { cloneIds, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(id)?.remove?.() }, { cloneIds });
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
      properties: { cur: { type: 'string', description: `Target cursor for paste (defaults to master)` }, i: { type: 'number', description: `How many copies to paste (defaults to 1)` } },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pastePrevSibling', cur, i });
      let frame = state.designer.current; let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard'); if (!html) return;
      let pos = 'beforebegin'; let cursors = [...frame.cursors[cur] || []]; if (!cursors.length) return; let cloneIds = [];
      await post('designer.pushHistory', cur, async apply => {
        if (apply && !cloneIds.length) {
          cloneIds = await ifeval(async ({ args }) => {
            let template = document.createElement('template'); template.innerHTML = args.html; let frags = [...template.content.children]; if (!frags.length) return [];
            let reversed = args.pos === 'afterbegin'; let items = reversed ? [...args.cursors].reverse() : args.cursors; let added = [];
            for (let i = 0; i < items.length; i++) { let f = frags[i % frags.length].cloneNode(true); f.removeAttribute('data-htmlsnap'); state.map.get(items[i]).insertAdjacentElement(args.pos, f); added.push(f); }
            await new Promise(pres => setTimeout(pres)); return added.map(x => state.map.getKey(x));
          }, { html, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else if (apply) {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(args.cursors[0])?.insertAdjacentElement?.(args.pos, state.map.get(id)) }, { cloneIds, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(id)?.remove?.() }, { cloneIds });
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
      properties: { cur: { type: 'string', description: `Target cursor for paste (defaults to master)` }, i: { type: 'number', description: `How many copies to paste (defaults to 1)` } },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pasteLastChild', cur, i });
      let frame = state.designer.current; let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard'); if (!html) return;
      let pos = 'beforeend'; let cursors = [...frame.cursors[cur] || []]; if (!cursors.length) return; let cloneIds = [];
      await post('designer.pushHistory', cur, async apply => {
        if (apply && !cloneIds.length) {
          cloneIds = await ifeval(async ({ args }) => {
            let template = document.createElement('template'); template.innerHTML = args.html; let frags = [...template.content.children]; if (!frags.length) return [];
            let reversed = args.pos === 'afterbegin'; let items = reversed ? [...args.cursors].reverse() : args.cursors; let added = [];
            for (let i = 0; i < items.length; i++) { let f = frags[i % frags.length].cloneNode(true); f.removeAttribute('data-htmlsnap'); state.map.get(items[i]).insertAdjacentElement(args.pos, f); added.push(f); }
            await new Promise(pres => setTimeout(pres)); return added.map(x => state.map.getKey(x));
          }, { html, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else if (apply) {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(args.cursors[0])?.insertAdjacentElement?.(args.pos, state.map.get(id)) }, { cloneIds, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(id)?.remove?.() }, { cloneIds });
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
      properties: { cur: { type: 'string', description: `Target cursor for paste (defaults to master)` }, i: { type: 'number', description: `How many copies to paste (defaults to 1)` } },
    },
    handler: async ({ cur = 'master', i = 1 } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'pasteFirstChild', cur, i });
      let frame = state.designer.current; let html = state.designer.clipboards[cur] || localStorage.getItem('webfoundry:clipboard'); if (!html) return;
      let pos = 'afterbegin'; let cursors = [...frame.cursors[cur] || []]; if (!cursors.length) return; let cloneIds = [];
      await post('designer.pushHistory', cur, async apply => {
        if (apply && !cloneIds.length) {
          cloneIds = await ifeval(async ({ args }) => {
            let template = document.createElement('template'); template.innerHTML = args.html; let frags = [...template.content.children]; if (!frags.length) return [];
            let reversed = args.pos === 'afterbegin'; let items = reversed ? [...args.cursors].reverse() : args.cursors; let added = [];
            for (let i = 0; i < items.length; i++) { let f = frags[i % frags.length].cloneNode(true); f.removeAttribute('data-htmlsnap'); state.map.get(items[i]).insertAdjacentElement(args.pos, f); added.push(f); }
            await new Promise(pres => setTimeout(pres)); return added.map(x => state.map.getKey(x));
          }, { html, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else if (apply) {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(args.cursors[0])?.insertAdjacentElement?.(args.pos, state.map.get(id)) }, { cloneIds, cursors, pos });
          await actions.changeSelection.handler({ cur, s: cloneIds });
        } else {
          await ifeval(({ args }) => { for (let id of args.cloneIds) state.map.get(id)?.remove?.() }, { cloneIds });
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
      if (!els.length) return;
      let wrapIds = [];
      let parentIds = els.map(x => frame.map.getKey(x.parentElement));
      let idxs = els.map(x => [...x.parentElement.children].indexOf(x));
      let elIds = els.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        if (apply && !wrapIds.length) {
          wrapIds = await ifeval(async ({ args }) => {
            let wrapped = [];
            for (let n = 0; n < args.els.length; n++) {
              let el = state.map.get(args.els[n]);
              let p = state.map.get(args.parents[n]);
              if (!el || !p) continue;
              let before = p.children[args.idxs[n]];
              let outer = document.createElement(args.tag);
              let last = outer;
              for (let j = 1; j < args.i; j++) { let inner = document.createElement(args.tag); last.appendChild(inner); last = inner }
              p.insertBefore(outer, before);
              last.appendChild(el);
              wrapped.push(outer);
            }
            await new Promise(pres => setTimeout(pres));
            return wrapped.map(x => state.map.getKey(x));
          }, { els: elIds, parents: parentIds, idxs, tag, i });
          await actions.changeSelection.handler({ cur, s: wrapIds });
        } else if (apply) {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.wrapIds.length; n++) {
              let w = state.map.get(args.wrapIds[n]);
              let p = state.map.get(args.parents[n]);
              let before = p.children[args.idxs[n]];
              if (!w || !p) continue;
              if (before) p.insertBefore(w, before); else p.appendChild(w);
              let inner = w;
              while (inner.firstElementChild && inner.firstElementChild.children.length === 1) inner = inner.firstElementChild;
              let el = state.map.get(args.els[n]);
              if (el) inner.appendChild(el);
            }
          }, { wrapIds, parents: parentIds, idxs, els: elIds });
          await actions.changeSelection.handler({ cur, s: wrapIds });
        } else {
          let unwrapped = await ifeval(async ({ args }) => {
            let result = [];
            for (let n = args.wrapIds.length - 1; n >= 0; n--) {
              let w = state.map.get(args.wrapIds[n]);
              let p = state.map.get(args.parents[n]);
              if (!w || !p) continue;
              let before = p.children[args.idxs[n]];
              let inner = w.firstElementChild;
              if (inner) { p.insertBefore(inner, before); result.push(state.map.getKey(inner)) }
              else {
                let children = [...w.childNodes];
                let anyElements = false;
                for (let c of children) { p.insertBefore(c, before); c.nodeType === 1 && result.push(state.map.getKey(c)); anyElements = true }
                if (!anyElements) result.push(state.map.getKey(p));
              }
              w.remove();
            }
            return result;
          }, { wrapIds, parents: parentIds, idxs });
          await actions.changeSelection.handler({ cur, s: unwrapped });
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
      if (!wrappers.length) return;
      let wrapIds = wrappers.map(x => frame.map.getKey(x));
      let parentIds = wrappers.map(x => frame.map.getKey(x.parentElement));
      let idxs = wrappers.map(x => [...x.parentElement.children].indexOf(x));
      await post('designer.pushHistory', cur, async apply => {
        if (apply) {
          await ifeval(async ({ args }) => {
            window.__unwrappedChildren ??= new Map(); // FIXME
            for (let n = args.wrapIds.length - 1; n >= 0; n--) {
              let w = state.map.get(args.wrapIds[n]);
              let p = state.map.get(args.parents[n]);
              if (!w || !p) continue;
              let before = p.children[args.idxs[n]];
              let children = [...w.childNodes];
              window.__unwrappedChildren.set(args.wrapIds[n], children);
              for (let c of children) p.insertBefore(c, before);
              w.remove();
            }
          }, { wrapIds, parents: parentIds, idxs });
          let promoted = await ifeval(({ args }) => {
            let result = [];
            for (let id of args.wrapIds) {
              let kids = window.__unwrappedChildren?.get(id) || [];
              for (let c of kids) if (c.nodeType === 1 && c.isConnected) result.push(state.map.getKey(c));
            }
            return result.length ? result : args.parents;
          }, { wrapIds, parents: parentIds });
          await actions.changeSelection.handler({ cur, s: promoted });
        } else {
          await ifeval(({ args }) => {
            let map = window.__unwrappedChildren;
            if (!map) return;
            for (let n = 0; n < args.wrapIds.length; n++) {
              let w = state.map.get(args.wrapIds[n]);
              let p = state.map.get(args.parents[n]);
              if (!w || !p) continue;
              let before = p.children[args.idxs[n]];
              if (before) p.insertBefore(w, before); else p.appendChild(w);
              let kids = map.get(args.wrapIds[n]);
              if (kids?.length) for (let c of kids) w.appendChild(c);
            }
          }, { wrapIds, parents: parentIds, idxs });
          await actions.changeSelection.handler({ cur, s: wrapIds });
        }
      });
    },
  },

  addCssClasses: {
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: {
      type: 'object',
      properties: { cur: { type: 'string', description: `Whose selection to use (defaults to master)` }, cls: { type: 'array', items: { type: 'string' } } },
      required: ['cls'],
    },
    handler: async ({ cur = 'master', cls } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'addCssClasses', cur, cls });
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (typeof cls === 'string') cls = cls.trim();
      let tokens = []; let re = /{{(?:[^{}]|{{[^}]*}})*}}|[^\s]+/g; let m;
      while (m = re.exec(cls)) tokens.push(m[0]);
      let exprs = tokens.filter(c => c.startsWith('{{') && c.endsWith('}}'));
      let normal = tokens.filter(c => !(c.startsWith('{{') && c.endsWith('}}')));
      let targetIds = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          self.__wfExprChanges ??= new Map();
          for (let id of args.targets) {
            let el = state.map.get(id);
            if (!el) continue;
            let attr = el.getAttribute('wf-class') || '';
            let existing = attr.length ? attr.split(/}}\s+(?={{)/).map(s => s.trim()).filter(Boolean) : [];
            if (args.apply) {
              for (let y of args.normal) el.classList.add(y);
              if (args.exprs.length) {
                let added = new Set();
                for (let e of args.exprs) if (!existing.includes(e)) added.add(e);
                let joined = existing.concat([...added]).join(' ');
                el.setAttribute('wf-class', joined.trim());
                self.__wfExprChanges.set(id, { added, removed: new Set() });
              }
            } else {
              for (let y of args.normal) el.classList.remove(y);
              if (args.exprs.length && el.hasAttribute('wf-class')) {
                let current = el.getAttribute('wf-class') || '';
                let parts = current.split(/}}\s+(?={{)/).map(s => s.trim()).filter(Boolean);
                let change = self.__wfExprChanges.get(id);
                let toRemove = change ? [...change.added] : args.exprs;
                let next = parts.filter(e => !toRemove.includes(e));
                el.setAttribute('wf-class', next.join(' '));
                if (change) change.removed = new Set(toRemove);
              }
            }
          }
        }, { targets: targetIds, normal, exprs, apply });
        await post('collab.sync');
      });
    },
  },

  removeCssClasses: {
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string', description: `Whose selection to use (defaults to master)` }, cls: { type: 'array', items: { type: 'string' } } }, required: ['cls'] },
    handler: async ({ cur = 'master', cls } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'removeCssClasses', cur, cls });
      let frame = state.designer.current; let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean); if (!targets.length) return;
      if (typeof cls === 'string') cls = cls.trim();
      let tokens = []; let re = /{{(?:[^{}]|{{[^}]*}})*}}|[^\s]+/g; let m; while (m = re.exec(cls)) tokens.push(m[0]);
      let exprs = tokens.filter(c => c.startsWith('{{') && c.endsWith('}}')); let normal = tokens.filter(c => !(c.startsWith('{{') && c.endsWith('}}')));
      let targetIds = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          self.__wfExprChanges ??= new Map();
          for (let id of args.targets) {
            let el = state.map.get(id); if (!el) continue;
            if (args.apply) {
              for (let y of args.normal) el.classList.remove(y);
              if (args.exprs.length && el.hasAttribute('wf-class')) {
                let current = el.getAttribute('wf-class') || '';
                let parts = current.split(/}}\s+(?={{)/).map(s => s.trim()).filter(Boolean);
                let removed = new Set(), remaining = [];
                for (let p of parts) if (args.exprs.includes(p)) removed.add(p); else remaining.push(p);
                el.setAttribute('wf-class', remaining.join(' '));
                self.__wfExprChanges.set(id, { added: new Set(), removed });
              }
            } else {
              for (let y of args.normal) el.classList.add(y);
              if (args.exprs.length) {
                let change = self.__wfExprChanges.get(id);
                let readd = change ? [...change.removed] : args.exprs;
                let existing = (el.getAttribute('wf-class') || '').split(/}}\s+(?={{)/).map(s => s.trim()).filter(Boolean);
                let joined = existing.concat(readd).join(' ');
                el.setAttribute('wf-class', joined.trim());
              }
            }
          }
        }, { targets: targetIds, normal, exprs, apply });
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
      if (old?.startsWith?.('wfregexp:')) old = new RegExp(old.slice('wfregexp:'.length + 1, -1));
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'replaceCssClasses', cur, old: old instanceof RegExp ? `wfregexp:${old}` : old, cls });
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (typeof cls === 'string') cls = cls.trim();
      let tokens = [];
      let re = /{{(?:[^{}]|{{[^}]*}})*}}|[^\s]+/g;
      let m;
      while (m = re.exec(cls)) tokens.push(m[0]);
      let exprs = tokens.filter(c => c.startsWith('{{') && c.endsWith('}}'));
      let normal = tokens.filter(c => !(c.startsWith('{{') && c.endsWith('}}')));
      let clsSet = new Set(normal);
      let targetIds = targets.map(x => frame.map.getKey(x));
      let removedBy = {};
      await post('designer.pushHistory', cur, async apply => {
        if (apply && !Object.keys(removedBy).length) {
          removedBy = await ifeval(async ({ args }) => {
            let out = {};
            for (let id of args.targets) {
              let el = state.map.get(id);
              if (!el) continue;
              let removed = [];
              if (args.old?.startsWith?.('wfregexp:')) {
                let re = new RegExp(args.old.slice('wfregexp:'.length + 1, -1));
                for (let c of [...el.classList]) if (re.test(c)) { el.classList.remove(c); removed.push(c) }
              }
              else if (args.old) {
                let olds = Array.isArray(args.old) ? args.old : args.old.split(/\s+/);
                for (let c of olds) if (el.classList.contains(c)) { el.classList.remove(c); removed.push(c) }
              }
              for (let c of args.cls) el.classList.add(c);
              if (args.exprs.length) {
                let current = el.getAttribute('wf-class') || '';
                let parts = current.split(/}}\s+(?={{)/).map(s => s.trim()).filter(Boolean);
                let added = new Set();
                for (let e of args.exprs) if (!parts.includes(e)) added.add(e);
                el.setAttribute('wf-class', parts.concat([...added]).join(' '));
              }
              out[id] = removed;
            }
            return out;
          }, { targets: targetIds, old: typeof old === 'string' ? old : (old instanceof RegExp ? `wfregexp:${old}` : ''), cls: [...clsSet], exprs });
        } else if (apply) {
          await ifeval(({ args }) => {
            for (let id of Object.keys(args.removedBy)) {
              let el = state.map.get(id);
              if (!el) continue;
              for (let c of args.removedBy[id] || []) el.classList.remove(c);
              for (let c of args.cls) el.classList.add(c);
            }
          }, { cls: [...clsSet], removedBy });
        } else {
          await ifeval(({ args }) => {
            for (let id of Object.keys(args.removedBy)) {
              let el = state.map.get(id); if (!el) continue;
              for (let c of args.cls) el.classList.remove(c);
              for (let c of args.removedBy[id] || []) el.classList.add(c);
            }
          }, { cls: [...clsSet], removedBy });
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
      let cursors = frame.cursors[cur];
      if (!cursors?.length) return;

      let replaced = cursors.map(id => frame.map.get(id)).filter(Boolean);
      let parents = replaced.map(x => x.parentElement);
      let idxs = replaced.map(x => [...x.parentElement.children].indexOf(x));

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

      let addedKeys = [];
      let replacedKeys = replaced.map(x => frame.map.getKey(x));
      let parentKeys = parents.map(x => frame.map.getKey(x));

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !addedKeys.length) {
          addedKeys = await ifeval(async ({ args }) => {
            let template = document.createElement('template');
            template.innerHTML = args.html;
            let newEls = [...template.content.children];
            let added = [];

            for (let n = 0; n < args.replaced.length; n++) {
              let el = state.map.get(args.replaced[n]);
              let p = state.map.get(args.parents[n]);
              let idx = args.idxs[n];
              if (!el || !p) continue;

              let newEl = newEls[n];
              if (!newEl) { el.remove(); continue; }

              if (['BODY','HTML','HEAD'].includes(el.tagName)) {
                for (let attr of [...newEl.attributes]) el.setAttribute(attr.name, attr.value);
                for (let attr of [...el.attributes]) if (!newEl.hasAttribute(attr.name)) el.removeAttribute(attr.name);
                while (el.firstChild) el.removeChild(el.firstChild);
                for (let child of [...newEl.childNodes]) el.appendChild(child.cloneNode(true));
              } else {
                p.replaceChild(newEl, el);
                added.push(newEl);
              }
            }

            await new Promise(pres => setTimeout(pres));
            return added.map(x => state.map.getKey(x));
          }, { html, replaced: replacedKeys, parents: parentKeys, idxs });
          await actions.changeSelection.handler({ cur, s: addedKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.replaced.length; n++) {
              let p = state.map.get(args.parents[n]);
              let idx = args.idxs[n];
              let newEl = state.map.get(args.added[n]);
              if (!p || !newEl) continue;
              let current = p.children[idx];
              if (current && current !== newEl) current.replaceWith(newEl);
              else if (!newEl.isConnected) {
                let prev = p.children[idx - 1];
                if (prev) prev.after(newEl);
                else p.insertBefore(newEl, p.firstChild);
              }
            }
          }, { replaced: replacedKeys, parents: parentKeys, idxs, added: addedKeys });
          await actions.changeSelection.handler({ cur, s: addedKeys });
        } else {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.added.length; n++) {
              let newEl = state.map.get(args.added[n]);
              if (newEl) newEl.remove();
            }
            for (let n = 0; n < args.replaced.length; n++) {
              let p = state.map.get(args.parents[n]);
              let el = state.map.get(args.replaced[n]);
              let idx = args.idxs[n];
              if (!p || !el) continue;
              let current = p.children[idx];
              if (current) current.replaceWith(el);
              else {
                let prev = p.children[idx - 1];
                if (prev) prev.after(el);
                else p.insertBefore(el, p.firstChild);
              }
            }
          }, { replaced: replacedKeys, parents: parentKeys, idxs, added: addedKeys });
          await actions.changeSelection.handler({ cur, s: replacedKeys });
        }
      });
    },
  },

  changeInnerHtml: {
    description: `Changes the inner HTML of selected elements (prompts if not provided)`,
    shortcut: 'M',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && state.designer.current.cursors[cur]?.length !== 1 && `A single element must be selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, html: { type: 'string' } } },
    handler: async ({ cur = 'master', html = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.innerHTML);
      if (html == null) {
        let [btn, val] = await showModal('CodeDialog', { title: 'Change HTML (inner)', initialValue: prev.join('\n') });
        if (btn !== 'ok') return;
        html = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeInnerHtml', cur, html });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (!el) continue;
            el.innerHTML = args.apply ? args.html : args.prev[n];
          }
        }, { targets: targetKeys, html, prev, apply });
        await actions.changeSelection.handler({ cur, s: targetKeys });
      });
    },
  },

  changeInputPlaceholder: {
    shortcut: 'Ctrl-p',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, placeholder: { type: 'string' } } },
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
      let targetKeys = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (!el) continue;
            let nv = args.apply ? args.placeholder : args.prev[n];
            nv ? el.setAttribute('placeholder', nv) : el.removeAttribute('placeholder');
          }
        }, { targets: targetKeys, placeholder, prev, apply });
      });
    },
  },

  changeFormMethod: {
    description: `Changes a form element's method attribute`,
    shortcut: 'Ctrl-M',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, method: { type: 'string' } } },
    handler: async ({ cur = 'master', method } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(x => x?.tagName === 'FORM');
      if (!targets.length) return;
      let prev = targets.map(x => x.getAttribute('method'));
      if (method == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change form method', label: 'Method', initialValue: prev[0] });
        if (btn !== 'ok') return;
        method = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeFormMethod', cur, method });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (!el) continue;
            let nv = args.apply ? args.method : args.prev[n];
            nv ? el.setAttribute('method', nv) : el.removeAttribute('method');
          }
        }, { targets: targetKeys, method, prev, apply });
      });
    },
  },

  toggleHidden: {
    description: `Toggles visibility of selected elements (via hidden attribute)`,
    shortcut: 'x',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' } } },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'toggleHidden', cur });
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.hidden);
      let targetKeys = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (el) el.hidden = args.apply ? !args.prev[n] : args.prev[n];
          }
        }, { targets: targetKeys, prev, apply });
      });
    },
  },

  replaceTextContent: {
    description: `If no text is provided, a single-line input modal is shown`,
    shortcut: 't',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, text: { type: 'string' } } },
    handler: async ({ cur = 'master', text } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.textContent);
      if (text == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Replace text', label: 'Text', initialValue: prev[0] });
        if (btn !== 'ok') return;
        text = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'replaceTextContent', cur, text });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (el) el.textContent = args.apply ? args.text : args.prev[n];
          }
        }, { targets: targetKeys, text, prev, apply });
      });
    },
  },

  replaceMultilineTextContent: {
    description: `Replaces the selected element's content with multiline input; prompts textarea if no text is provided`,
    shortcut: 'T',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, text: { type: 'string' } } },
    handler: async ({ cur = 'master', text } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.textContent);
      if (text == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Replace text (multiline)', label: 'Text', initialValue: prev.join('\n'), multiline: true });
        if (btn !== 'ok') return;
        text = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'replaceMultilineTextContent', cur, text });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (el) el.textContent = args.apply ? args.text : args.prev[n];
          }
        }, { targets: targetKeys, text, prev, apply });
      });
    },
  },

  changeLinkUrl: {
    shortcut: 'H',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, url: { type: 'string' } } },
    handler: async ({ cur = 'master', url } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(x => x.tagName === 'A');
      if (!targets.length) return;
      let prev = targets.map(x => x.getAttribute('href'));
      if (url == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change link URL', label: 'URL', initialValue: prev[0] });
        if (btn !== 'ok') return;
        url = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeLinkUrl', cur, url });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (!el) continue;
            let nv = args.apply ? args.url : args.prev[n];
            nv ? el.setAttribute('href', nv) : el.removeAttribute('href');
          }
        }, { targets: targetKeys, url, prev, apply });
      });
    },
  },

  changeMediaSrc: {
    shortcut: 's',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, url: { type: 'string' } } },
    handler: async ({ cur = 'master', url } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prevSrcs = targets.map(x => x.getAttribute('src'));
      if (url == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change media source', label: 'URL', initialValue: prevSrcs[0] });
        if (btn !== 'ok') return;
        url = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeMediaSrc', cur, url });

      let mime = mimeLookup(url);
      let newTag = mime?.startsWith?.('audio/') ? 'audio' : mime?.startsWith?.('video/') ? 'video' : 'img';
      let targetKeys = targets.map(x => frame.map.getKey(x));
      let parentKeys = targets.map(x => frame.map.getKey(x.parentElement));
      let idxs = targets.map(x => [...x.parentElement.children].indexOf(x));
      let newKeys = [];

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !newKeys.length) {
          newKeys = await ifeval(async ({ args }) => {
            let result = [];
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              if (!el || !p) continue;
              let tag = args.newTag && args.newTag !== el.tagName.toLowerCase() ? args.newTag : el.tagName.toLowerCase();
              if (tag === el.tagName.toLowerCase()) {
                el.setAttribute('src', args.url);
                result.push(state.map.getKey(el));
                continue;
              }
              let clone = document.createElement(tag);
              for (let a of el.attributes) clone.setAttribute(a.name, a.value);
              clone.className = el.className;
              clone.innerHTML = el.innerHTML;
              clone.setAttribute('src', args.url);
              if (p.children[i] === el) p.replaceChild(clone, el);
              else p.insertBefore(clone, p.children[i] || null);
              result.push(clone);
            }
            await new Promise(pres => setTimeout(pres));
            return result.map(x => state.map.getKey(x));
          }, { targets: targetKeys, parents: parentKeys, idxs, url, newTag });
          await actions.changeSelection.handler({ cur, s: newKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let clone = state.map.get(args.newKeys[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              if (!p) continue;
              if (clone && el && el.tagName.toLowerCase() !== clone.tagName.toLowerCase()) {
                if (p.children[i] === el) p.replaceChild(clone, el);
              }
              (clone || el)?.setAttribute('src', args.url);
            }
          }, { targets: targetKeys, parents: parentKeys, idxs, newKeys, url });
          await actions.changeSelection.handler({ cur, s: newKeys });
        } else {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let clone = state.map.get(args.newKeys[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              if (!p) continue;
              if (clone && el && clone.tagName.toLowerCase() !== el.tagName.toLowerCase()) {
                if (p.children[i] === clone) p.replaceChild(el, clone);
              }
              let prev = args.prevSrcs[n];
              if (prev) el.setAttribute('src', prev); else el.removeAttribute('src');
            }
          }, { targets: targetKeys, parents: parentKeys, idxs, newKeys, prevSrcs });
          await actions.changeSelection.handler({ cur, s: targetKeys });
        }
      });
    },
  },

  // TODO: Test if possible to create a "list gallery media" function and reply using the success object in a usable way.
  changeMediaSrcFromGallery: {
    shortcut: 'S',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' } } },
    handler: async ({ cur = 'master' } = {}) => {
      let frame = state.designer.current;
      let [btn, url] = await showModal('MediaGalleryDialog');
      if (btn !== 'ok' || !url) return;
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeMediaSrcFromGallery', cur, url });

      let mime = mimeLookup(url);
      let newTag = mime?.startsWith?.('audio/') ? 'audio' : mime?.startsWith?.('video/') ? 'video' : 'img';
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prevSrcs = targets.map(x => x.getAttribute('src'));
      let targetKeys = targets.map(x => frame.map.getKey(x));
      let parentKeys = targets.map(x => frame.map.getKey(x.parentElement));
      let idxs = targets.map(x => [...x.parentElement.children].indexOf(x));
      let newKeys = [];

      await post('designer.pushHistory', cur, async apply => {
        if (apply && !newKeys.length) {
          newKeys = await ifeval(async ({ args }) => {
            let result = [];
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              if (!el || !p) continue;
              let tag = args.newTag && args.newTag !== el.tagName.toLowerCase() ? args.newTag : el.tagName.toLowerCase();
              if (tag === el.tagName.toLowerCase()) {
                el.setAttribute('src', args.url);
                result.push(state.map.getKey(el));
                continue;
              }
              let clone = document.createElement(tag);
              for (let a of el.attributes) clone.setAttribute(a.name, a.value);
              clone.className = el.className;
              clone.innerHTML = el.innerHTML;
              clone.setAttribute('src', args.url);
              if (p.children[i] === el) p.replaceChild(clone, el);
              else p.insertBefore(clone, p.children[i] || null);
              result.push(clone);
            }
            await new Promise(pres => setTimeout(pres));
            return result.map(x => state.map.getKey(x));
          }, { targets: targetKeys, parents: parentKeys, idxs, url, newTag });
          await actions.changeSelection.handler({ cur, s: newKeys });
        } else if (apply) {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let clone = state.map.get(args.newKeys[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              if (!p) continue;
              if (clone && el && el.tagName.toLowerCase() !== clone.tagName.toLowerCase()) {
                if (p.children[i] === el) p.replaceChild(clone, el);
              }
              (clone || el)?.setAttribute('src', args.url);
            }
          }, { targets: targetKeys, parents: parentKeys, idxs, newKeys, url });
          await actions.changeSelection.handler({ cur, s: newKeys });
        } else {
          await ifeval(({ args }) => {
            for (let n = 0; n < args.targets.length; n++) {
              let el = state.map.get(args.targets[n]);
              let clone = state.map.get(args.newKeys[n]);
              let p = state.map.get(args.parents[n]);
              let i = args.idxs[n];
              if (!p) continue;
              if (clone && el && clone.tagName.toLowerCase() !== el.tagName.toLowerCase()) {
                if (p.children[i] === clone) p.replaceChild(el, clone);
              }
              let prev = args.prevSrcs[n];
              if (prev) el.setAttribute('src', prev); else el.removeAttribute('src');
            }
          }, { targets: targetKeys, parents: parentKeys, idxs, newKeys, prevSrcs });
          await actions.changeSelection.handler({ cur, s: targetKeys });
        }
      });
    },
  },

  changeBackgroundUrl: {
    shortcut: 'b',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, url: { type: 'string' } } },
    handler: async ({ cur = 'master', url = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.style.backgroundImage);
      if (url == null) {
        let [btn, val] = await showModal('PromptDialog', { title: 'Change background image', label: 'Image URL', initialValue: prev[0]?.replace(/^url\(["']?|["']?\)$/g, '') });
        if (btn !== 'ok') return;
        url = val;
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeBackgroundUrl', cur, url });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      let newBg = url ? `url("${url}")` : '';
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (el) el.style.backgroundImage = args.apply ? args.newBg : args.prev[n];
          }
        }, { targets: targetKeys, newBg, prev, apply });
        await actions.changeSelection.handler({ cur, s: targetKeys });
      });
    },
  },

  changeBackgroundFromGallery: {
    shortcut: 'B',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' } } },
    handler: async ({ cur = 'master' } = {}) => {
      let frame = state.designer.current;
      let [btn, url] = await showModal('MediaGalleryDialog');
      if (btn !== 'ok' || !url) return;
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'changeBackgroundFromGallery', cur, url });
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      let prev = targets.map(x => x.style.backgroundImage);
      let targetKeys = targets.map(x => frame.map.getKey(x));
      let newBg = url ? `url("${url}")` : '';
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (el) el.style.backgroundImage = args.apply ? args.newBg : args.prev[n];
          }
        }, { targets: targetKeys, newBg, prev, apply });
        await actions.changeSelection.handler({ cur, s: targetKeys });
      });
    },
  },

  setIfExpression: {
    description: `Sets conditional expression for displaying elements (prompts if not provided)`,
    shortcut: 'Ctrl-i',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, expr: { type: 'string' } } },
    handler: async ({ cur = 'master', expr = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (expr == null) {
        let initial = targets[0].getAttribute('wf-if');
        let [btn, val] = await showModal('PromptDialog', { title: 'Set if expression', placeholder: 'Expression', initialValue: initial });
        if (btn !== 'ok') return;
        expr = val.trim();
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'setIfExpression', cur, expr });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      let prev = targets.map(x => x.getAttribute('wf-if'));
      let newVal = expr;
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (!el) continue;
            let nv = args.apply ? args.newVal : args.prev[n];
            nv ? el.setAttribute('wf-if', nv) : el.removeAttribute('wf-if');
          }
        }, { targets: targetKeys, newVal, prev, apply });
        await actions.changeSelection.handler({ cur, s: targetKeys });
      });
    },
  },

  setMapExpression: {
    description: `Sets map expression for repeating elements (prompts if not provided)`,
    shortcut: 'Ctrl-m',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, expr: { type: 'string' } } },
    handler: async ({ cur = 'master', expr = null } = {}) => {
      let frame = state.designer.current;
      let targets = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!targets.length) return;
      if (expr == null) {
        let initial = targets[0].getAttribute('wf-map');
        let [btn, val] = await showModal('PromptDialog', { title: 'Set map expression', placeholder: 'Expression (item of expr)', initialValue: initial });
        if (btn !== 'ok') return;
        expr = val.trim();
      }
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'setMapExpression', cur, expr });
      let targetKeys = targets.map(x => frame.map.getKey(x));
      let prev = targets.map(x => x.getAttribute('wf-map'));
      let newVal = expr;
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (!el) continue;
            let nv = args.apply ? args.newVal : args.prev[n];
            nv ? el.setAttribute('wf-map', nv) : el.removeAttribute('wf-map');
          }
        }, { targets: targetKeys, newVal, prev, apply });
        await actions.changeSelection.handler({ cur, s: targetKeys });
      });
    },
  },

  setEventHandlers: {
    shortcut: 'Ctrl-o',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && state.designer.current.cursors[cur]?.length !== 1 && `A single element must be selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' } } },
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
      let targetKey = frame.map.getKey(el);
      let prev = prevHandlers;
      let next = Array.isArray(handlers) ? handlers.filter(h => h && h.name && h.expr) : [];
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          let el = state.map.get(args.target);
          if (!el) return;
          for (let attr of [...el.attributes]) if (attr.name.startsWith('wf-on')) el.removeAttribute(attr.name);
          let list = args.apply ? args.next : args.prev;
          for (let h of list) if (h.name && h.expr) el.setAttribute(`wf-on${h.name}`, h.expr);
        }, { target: targetKey, prev, next, apply });
      });
    },
  },

  setDisabledExpression: {
    shortcut: 'Ctrl-D',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && !state.designer.current.cursors[cur]?.length && `No elements selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' }, expr: { type: 'string' } } },
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
      let targetKeys = targets.map(x => frame.map.getKey(x));
      let prev = targets.map(x => x.getAttribute('wf-disabled'));
      let newVal = expr;
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (!el) continue;
            let nv = args.apply ? args.newVal : args.prev[n];
            nv ? el.setAttribute('wf-disabled', nv) : el.removeAttribute('wf-disabled');
          }
        }, { targets: targetKeys, newVal, prev, apply });
        await actions.changeSelection.handler({ cur, s: targetKeys });
      });
    },
  },

  normalizeStylesUnion: {
    description: `Makes all selected elements have the union of their classes`,
    shortcut: 'Alt-u',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && (state.designer.current.cursors[cur]?.length || 0) < 2 && `At least 2 elements must be selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' } } },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'normalizeStylesUnion', cur });
      let frame = state.designer.current;
      let all = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!all.length) return;
      let targetKeys = all.map(x => frame.map.getKey(x));
      let prev = all.map(x => x.className);
      let union = new Set();
      for (let el of all) for (let c of el.classList) union.add(c);
      let merged = [...union].join(' ').trim();
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (el) el.className = args.apply ? args.merged : args.prev[n];
          }
        }, { targets: targetKeys, merged, prev, apply });
      });
    },
  },

  normalizeStylesIntersect: {
    description: `Makes all selected elements have the intersection of their classes`,
    shortcut: 'Alt-U',
    disabled: ({ cur = 'master' }) => [!state.designer.open && `Designer closed.`, state.designer.open && (state.designer.current.cursors[cur]?.length || 0) < 2 && `At least 2 elements must be selected.`],
    parameters: { type: 'object', properties: { cur: { type: 'string' } } },
    handler: async ({ cur = 'master' } = {}) => {
      if (state.collab.uid !== 'master') return state.collab.rtc.send({ type: 'cmd', k: 'normalizeStylesIntersect', cur });
      let frame = state.designer.current;
      let all = frame.cursors[cur].map(x => frame.map.get(x)).filter(Boolean);
      if (!all.length) return;
      let targetKeys = all.map(x => frame.map.getKey(x));
      let prev = all.map(x => x.className);
      let intersection = new Set(all[0].classList);
      for (let i = 1; i < all.length; i++) for (let c of [...intersection]) if (!all[i].classList.contains(c)) intersection.delete(c);
      let merged = [...intersection].join(' ').trim();
      await post('designer.pushHistory', cur, async apply => {
        await ifeval(({ args }) => {
          for (let n = 0; n < args.targets.length; n++) {
            let el = state.map.get(args.targets[n]);
            if (el) el.className = args.apply ? args.merged : args.prev[n];
          }
        }, { targets: targetKeys, merged, prev, apply });
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

let ifeval = (fn, args) => new Promise((resolve, reject) => {
  let frame = state.designer.current;
  let iforigin = new URL(frame.el.src).origin;
  let rpcid = crypto.randomUUID();
  let body = fn.toString().replace(/^async\s*/, '').replace(/^[^(]*\([^)]*\)\s*=>\s*\{?/, '').replace(/\}$/, '').trim();
  let listener = ev => {
    if (ev.origin !== iforigin || ev.data.type !== 'eval:res' || ev.data.rpcid !== rpcid) return;
    removeEventListener('message', listener);
    if (ev.data.error) reject(new Error(ev.data.error));
    else resolve(ev.data.result);
  };
  addEventListener('message', listener);
  frame.el.contentWindow.postMessage({ type: 'eval', fn: body, rpcid, args }, iforigin);
});

function patchWfClass(el, { add = [], remove = [], replace = null }) {
  let attr = el.getAttribute('wf-class');
  if (!attr) return;
  let pieces = [...attr.matchAll(/{{[\s\S]*?}}/g)].map(m => m[0]);
  let newPieces = [];
  for (let p of pieces) {
    let expr = p;
    for (let c of remove) expr = expr.replaceAll(new RegExp(`['"\`]${c}['"\`]`, 'g'), "''");
    if (replace?.old && replace?.cls) for (let oldC of replace.old) for (let newC of replace.cls) expr = expr.replaceAll(new RegExp(`['"\`]${oldC}['"\`]`, 'g'), `'${newC}'`);
    if (add.length && !/['"]/.test(expr)) {
      let additions = add.map(c => `'${c}'`).join(' + " " + ');
      expr = `(${expr}) + " " + (${additions})`;
    }
    newPieces.push(expr);
  }
  el.setAttribute('wf-class', newPieces.join(' '));
}

export default actions;
