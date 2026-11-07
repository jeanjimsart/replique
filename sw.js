// Réseau d'abord, cache en secours : l'appli marche hors ligne avec la dernière version vue.
const CACHE = 'replique-v5';
const COQUILLE = ['./', 'index.html', 'style.css', 'app.js', 'data/fiches.json', 'data/comparateur.json', 'manifest.webmanifest', 'icones/icone.svg', 'icones/icone-192.png', 'icones/icone-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { const copie = r.clone(); caches.open(CACHE).then(c => c.put(req, copie)); return r; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
