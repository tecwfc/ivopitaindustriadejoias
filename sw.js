const CACHE_NAME = 'ivo-pita-v10';
const urlsToCache = [
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/assets/papel_ivo_preto.png'
];

// INSTALL
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

// ACTIVATE — Limpa TODOS os caches antigos
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

// FETCH — HTML sempre da rede; CSS/JS podem usar cache
self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (event.request.method !== 'GET') return;

  // 🚫 NUNCA cacheia HTML
  if (
    event.request.mode === 'navigate' ||
    url.endsWith('.html') ||
    url.endsWith('/') ||
    url.includes('index.html') ||
    url.includes('login.html') ||
    url.includes('admin.html')
  ) {
    return;
  }

  // 🚫 NUNCA cacheia imagens do Google Drive nem CDNs/APIs
  if (
    url.includes('googleusercontent.com') ||  // ⚡ ESSA LINHA
    url.includes('drive.google.com') ||       // ⚡ ESSA LINHA
    url.includes('cdn.tailwindcss.com') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('script.google.com') ||
    url.includes('docs.google.com') ||
    url.includes('via.placeholder.com') ||
    url.includes('wa.me')
  ) {
    return;
  }

  // ✅ CSS, JS locais → Network First com fallback cache
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
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
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
