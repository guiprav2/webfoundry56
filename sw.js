self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', ev => ev.waitUntil(self.clients.claim()));
async function storeTab(tabId, clientId) {
  let cache = await caches.open('webfoundry-tabs');
  await cache.put(tabId, new Response(clientId));
}
async function getTab(tabId) {
  let cache = await caches.open('webfoundry-tabs');
  let res = await cache.match(tabId);
  return res && await res.text();
}
self.addEventListener('message', async ev => {
  let { data } = ev;
  if (data.type !== 'webfoundry-register-tab') return;
  await storeTab(data.tabId, ev.source.id);
});
self.addEventListener('fetch', async ev => {
  let url = new URL(ev.request.url);
  let pathname = url.pathname;
  if (url.port && pathname.endsWith('.html')) return;
  let prefix = null;
  if (pathname.startsWith('/files/')) prefix = '/files/';
  else if (pathname.startsWith('/preview/')) prefix = '/preview/';
  else return;
  let parts = pathname.slice(prefix.length).split('/');
  let tabId = parts.shift();
  let project = parts.shift();
  let isPreview = prefix === '/preview/';
  let path = isPreview && pathname.endsWith('.html') ? 'index.html' : parts.join('/');
  ev.respondWith(new Promise(async (resolve, reject) => {
    let channel = new MessageChannel();
    let timeout = setTimeout(() => reject(new Error('Request timeout')), 30000);
    channel.port1.onmessage = e => {
      clearTimeout(timeout);
      let { status, error, data } = e.data || {};
      if (error) return resolve(new Response(error, { status }));
      resolve(new Response(data, { status }));
    };
    let client = await self.clients.get(await getTab(tabId));
    if (!client) return fetch(ev.request);
    client.postMessage({ type: 'fetch', project, path }, [channel.port2]);
  }).catch(err => new Response(err.message, { status: 503 })));
});
