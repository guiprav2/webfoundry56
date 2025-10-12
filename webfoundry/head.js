(async () => {
  let cfg = (await import('../wf.config.js')).default;
  let promises = [];
  let prefix = location.pathname.startsWith('/files/') ? '../' : '';
  if (cfg.nerdfonts) {
    let link = document.createElement('link');
    link.className = 'wf-nf-link';
    link.rel = 'stylesheet';
    link.href = 'https://www.nerdfonts.com/assets/css/webfont.css';
    let plink = Promise.withResolvers();
    link.onload = () => plink.resolve('nf');
    link.onerror = err => plink.reject(err);
    promises.push(plink.promise);
    document.head.append(link);
  }
  if (cfg.tailwind) {
    let script = document.createElement('script');
    script.className = 'wf-tw-script';
    script.src = `${prefix}webfoundry/tailplay4.dafuq.js`;
    let pscript = Promise.withResolvers();
    script.onload = () => pscript.resolve('tw');
    script.onerror = err => pscript.reject(err);
    document.head.append(script);
    promises.push(pscript.promise);
  }
  if (cfg.betterscroll) {
    let style = document.createElement('style');
    style.className = 'wf-betterscroll-style';
    style.textContent = `::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb {
  background-color: grey;
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #b0b0b0;
}
::-webkit-scrollbar-thumb:horizontal {
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:vertical {
  background-clip: padding-box;
}
`;
    document.head.append(style);
  }
  {
    let preflight = document.createElement('style');
    preflight.className = 'wf-preflight';
    preflight.textContent = `[hidden] { display: none !important } body { display: flow-root } dialog { margin: auto }`;
    let ppreflight = Promise.withResolvers();
    preflight.onload = () => ppreflight.resolve('preflight');
    preflight.onerror = err => ppreflight.reject(err);
    promises.push(ppreflight.promise);
    document.head.append(preflight);
  }
  await Promise.all(promises);
  let div = document.createElement('div'); document.body.append(div); div.remove();
  document.body.style.display = 'flow-root';
})();
