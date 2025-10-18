import '../other/util.js';

export default class App {
  actions = {
    init: async () => {
      this.state.demo = location.search.includes('demo');
      if (this.state.demo) document.body.classList.add('text-xs');
      if (top === window || this.state.demo) {
        sessionStorage.webfoundryTabId ??= crypto.randomUUID();
        await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) return location.reload();
        let register = () => navigator.serviceWorker.controller.postMessage({ type:'webfoundry-register-tab', tabId: sessionStorage.webfoundryTabId });
        navigator.serviceWorker.addEventListener('controllerchange', register);
        setInterval(register, 1000);
        register();
      }
      this.state.mobile = (() => {
        if (typeof navigator === 'undefined') return false;
        if (navigator.userAgentData?.mobile) return true;
        let ua = navigator.userAgent || '';
        let hasCoarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        let hasTouchPoints = (navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0) > 1;
        let mobileRe = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
        return mobileRe.test(ua) || hasCoarsePointer || hasTouchPoints;
      })();
      await post('event.init');
      await post('broadcast.init');
      await post('collab.init');
      await post('settings.init');
      if (!location.pathname.startsWith('/collab.html')) {
        await post('projects.init');
        await post('companion.init');
      }
      await post('shell.init');
      await post('files.init');
      await post('codeEditor.init');
      await post('styles.init');
      await post('designer.init');
      await post('app.brandCanvasMonitor');
      (!this.state.demo && state.collab.uid === 'master') && await post('app.selectPanel', 'projects');
      state.event.bus.on('designer:togglePreview:ready', async ({ preview }) => preview && this.state.panel === 'styles' && await post('app.selectPanel', null));
      state.event.bus.on('files:select:ready', async ({ path }) => this.state.mobile && path && await post('app.selectPanel', null));
    },

    selectPanel: x => {
      this.state.panel = x;
      state.event.bus.emit('app:selectPanel:ready', { id: x });
    },

    brandCanvasMonitor: () => {
      try {
        let canvas = document.querySelector('#Canvas');
        let empty = [...canvas.children].slice(1).every(x => x.classList.contains('hidden'));
        if (this.state.brandCanvas === empty) return;
        this.state.brandCanvas = empty;
        d.updateSync();
      } finally {
        requestAnimationFrame(async () => await post('app.brandCanvasMonitor'));
      }
    },
  };
};
