import '../other/util.js';

export default class App {
  actions = {
    init: async () => {
      if (top === window) {
        sessionStorage.webfoundryTabId ??= crypto.randomUUID();
        await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) return location.reload();
        let register = () => navigator.serviceWorker.controller.postMessage({ type:'webfoundry-register-tab', tabId: sessionStorage.webfoundryTabId });
        navigator.serviceWorker.addEventListener('controllerchange', register);
        setInterval(register, 1000);
        register();
      }
      await post('event.init');
      await post('broadcast.init');
      if (!location.pathname.startsWith('/collab.html')) {
        await post('settings.init');
        await post('projects.init');
        await post('companion.init');
        await post('shell.init');
      }
      await post('files.init');
      //await post('collab.init');
      await post('codeEditor.init');
      await post('styles.init');
      //await post('designer.init');
      await post('app.brandCanvasMonitor');
    },

    selectPanel: x => {
      this.state.panel = x;
      state.event.bus.emit('app:panel:select', { id: x });
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
