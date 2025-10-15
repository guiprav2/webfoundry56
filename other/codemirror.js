const CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16';
const SCRIPT_CACHE = new Map();
const STYLE_CACHE = new Map();
let basePromise;

function ensureStylesheet(href) {
  if (STYLE_CACHE.has(href)) return STYLE_CACHE.get(href);
  let existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
  if (existing) {
    let promise = Promise.resolve();
    STYLE_CACHE.set(href, promise);
    return promise;
  }
  let link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  let promise = new Promise((resolve, reject) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet ${href}`)), { once: true });
  });
  STYLE_CACHE.set(href, promise);
  document.head.append(link);
  return promise;
}

function ensureScript(src) {
  if (SCRIPT_CACHE.has(src)) return SCRIPT_CACHE.get(src);
  let existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    if (existing.dataset?.cmLoaded === 'true' || existing.readyState === 'complete' || existing.readyState === 'loaded') {
      let promise = Promise.resolve();
      SCRIPT_CACHE.set(src, promise);
      return promise;
    }
    existing.dataset.cmLoaded = 'pending';
    let promise = new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        existing.dataset.cmLoaded = 'true';
        resolve();
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script ${src}`)), { once: true });
    });
    SCRIPT_CACHE.set(src, promise);
    return promise;
  }
  let script = document.createElement('script');
  script.async = false;
  script.src = src;
  script.dataset.cmLoaded = 'pending';
  let promise = new Promise((resolve, reject) => {
    script.addEventListener('load', () => {
      script.dataset.cmLoaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load script ${src}`)), { once: true });
  });
  SCRIPT_CACHE.set(src, promise);
  document.head.append(script);
  return promise;
}

function resolveThemeName(name) {
  if (!name) return 'monokai';
  let key = name.toString().toLowerCase();
  const aliases = {
    'default': 'default',
    'light': 'default',
    'monokai': 'monokai',
    'monokai_dimmed': 'monokai',
    'github': 'neo',
    'github_dark': 'material-darker',
    'dracula': 'dracula',
    'solarized_dark': 'solarized',
    'solarized_light': 'solarized',
    'twilight': 'twilight',
    'tomorrow': 'eclipse',
    'tomorrow_night': 'material-darker',
    'one_dark': 'material-darker',
    'xcode': 'xq-light',
    'textmate': 'default',
    'eclipse': 'eclipse',
    'ambiance': 'ambiance',
  };
  return aliases[key] || (THEME_FILES[name] ? name : 'monokai');
}

const THEME_FILES = {
  'ambiance': `${CDN_BASE}/theme/ambiance.min.css`,
  'dracula': `${CDN_BASE}/theme/dracula.min.css`,
  'eclipse': `${CDN_BASE}/theme/eclipse.min.css`,
  'material-darker': `${CDN_BASE}/theme/material-darker.min.css`,
  'monokai': `${CDN_BASE}/theme/monokai.min.css`,
  'neo': `${CDN_BASE}/theme/neo.min.css`,
  'solarized': `${CDN_BASE}/theme/solarized.min.css`,
  'twilight': `${CDN_BASE}/theme/twilight.min.css`,
  'xq-light': `${CDN_BASE}/theme/xq-light.min.css`,
};

const MODE_BUNDLES = {
  'css': [`${CDN_BASE}/mode/css/css.min.js`],
  'htmlmixed': [
    `${CDN_BASE}/mode/xml/xml.min.js`,
    `${CDN_BASE}/mode/javascript/javascript.min.js`,
    `${CDN_BASE}/mode/css/css.min.js`,
    `${CDN_BASE}/mode/htmlmixed/htmlmixed.min.js`,
  ],
  'javascript': [`${CDN_BASE}/mode/javascript/javascript.min.js`],
  'markdown': [
    `${CDN_BASE}/mode/xml/xml.min.js`,
    `${CDN_BASE}/mode/markdown/markdown.min.js`,
    `${CDN_BASE}/mode/javascript/javascript.min.js`,
  ],
  'json': [`${CDN_BASE}/mode/javascript/javascript.min.js`],
};

const KEYMAP_FILES = {
  'vim': `${CDN_BASE}/keymap/vim.min.js`,
};

const MODE_ALIASES = {
  'html': 'htmlmixed',
  'htm': 'htmlmixed',
  'css': 'css',
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'javascript',
  'tsx': 'javascript',
  'md': 'markdown',
  'markdown': 'markdown',
  'json': 'json',
};

async function ensureBase() {
  if (!basePromise) {
    basePromise = (async () => {
      await Promise.all([
        ensureStylesheet(`${CDN_BASE}/codemirror.min.css`),
        ensureScript(`${CDN_BASE}/codemirror.min.js`),
      ]);
      await ensureScript(`${CDN_BASE}/addon/selection/active-line.min.js`);
    })();
  }
  return basePromise;
}

async function ensureMode(mode) {
  if (!mode) return null;
  let resolved = MODE_ALIASES[mode] || mode;
  let files = MODE_BUNDLES[resolved];
  if (!files) return resolved;
  await ensureBase();
  await Promise.all(files.map(ensureScript));
  return resolved;
}

async function ensureTheme(theme) {
  let resolved = resolveThemeName(theme);
  if (resolved === 'default') return resolved;
  let href = THEME_FILES[resolved];
  if (!href) return 'monokai';
  await ensureStylesheet(href);
  return resolved;
}

async function ensureKeyMap(keyMap) {
  if (!keyMap) return null;
  let resolved = keyMap.toLowerCase();
  let file = KEYMAP_FILES[resolved];
  if (!file) return resolved;
  await ensureBase();
  await ensureScript(file);
  return resolved;
}

export async function mountCodeMirror(container, options = {}) {
  await ensureBase();
  let textarea = options.textarea || document.createElement('textarea');
  if (!options.textarea) {
    textarea.value = options.value || '';
    container.append(textarea);
  }
  let mode = await ensureMode(options.mode || null);
  let theme = await ensureTheme(options.theme || null);
  let keyMap = options.keyMap ? await ensureKeyMap(options.keyMap) : null;
  let cm = window.CodeMirror.fromTextArea(textarea, {
    value: options.textarea ? textarea.value : (options.value || ''),
    mode: mode || undefined,
    theme: theme === 'default' ? undefined : theme,
    tabSize: options.tabSize ?? 2,
    indentUnit: options.tabSize ?? 2,
    indentWithTabs: options.indentWithTabs ?? false,
    lineNumbers: options.lineNumbers ?? true,
    lineWrapping: options.lineWrapping ?? true,
    autofocus: options.autofocus ?? false,
    styleActiveLine: true,
  });
  cm.setSize('100%', '100%');
  if (options.fontSize) {
    cm.getWrapperElement().style.fontSize = typeof options.fontSize === 'number' ? `${options.fontSize}px` : options.fontSize;
  }
  if (keyMap && keyMap !== 'default') cm.setOption('keyMap', keyMap);
  let changeHandler;
  if (typeof options.onChange === 'function') {
    changeHandler = (...args) => options.onChange(cm, ...args);
    cm.on('change', changeHandler);
  }
  return {
    editor: cm,
    destroy() {
      if (changeHandler) cm.off('change', changeHandler);
      cm.toTextArea();
      if (!options.textarea) textarea.remove();
    },
    async setTheme(nextTheme) {
      let resolved = await ensureTheme(nextTheme);
      cm.setOption('theme', resolved === 'default' ? undefined : resolved);
    },
    async setKeyMap(nextKeyMap) {
      if (!nextKeyMap || nextKeyMap === 'default') {
        cm.setOption('keyMap', 'default');
        return;
      }
      let resolved = await ensureKeyMap(nextKeyMap);
      cm.setOption('keyMap', resolved || nextKeyMap);
    },
    async setMode(nextMode) {
      let resolved = await ensureMode(nextMode);
      cm.setOption('mode', resolved || nextMode);
    },
  };
}

export async function ensureCodeMirrorTheme(theme) {
  return ensureTheme(theme);
}

export async function ensureCodeMirrorKeyMap(keyMap) {
  return ensureKeyMap(keyMap);
}

export async function ensureCodeMirrorMode(mode) {
  return ensureMode(mode);
}

export async function loadCodeMirrorBase() {
  await ensureBase();
}
