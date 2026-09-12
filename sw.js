// sw.js - Service Worker para PWA (CORRIGIDO - Sem CORS)
const CACHE_NAME ='ivo-pita-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

// INSTALL - Cacheia arquivos locais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.warn('⚠️ Falha ao cachear:', url, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE - Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH - Ignora CDNs e APIs
self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (event.request.method !== 'GET') return;

  if (
    url.includes('cdn.tailwindcss.com') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('script.google.com') ||
    url.includes('docs.google.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('via.placeholder.com') ||
    url.includes('wa.me')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        
        return fetch(event.request).then(networkResponse => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
