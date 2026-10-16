const CACHE_NAME = 'ivo-pita-v13';  // ← suba aqui
const CACHE_IMAGENS = 'ivo-imagens-v2'; // ← e aqui

const urlsToCache = [
  './styles.css',
  './script.js',
  './manifest.json',
  './assets/papel_ivo_preto.png'
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

// ACTIVATE — Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== CACHE_IMAGENS) {
            console.log('🗑️ Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH
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

  // ✅ Cache-First para imagens do Google Drive
if (
  url.includes('googleusercontent.com') ||  // ← CAPTURA TODOS OS LH*
  url.includes('lh3.google.com') ||
  url.includes('lh4.google.com') ||
  url.includes('lh5.google.com') ||
  url.includes('lh6.google.com') ||
  url.includes('res.cloudinary.com') ||
  url.includes('b-cdn.net')
) {
  event.respondWith(
    caches.open(CACHE_IMAGENS).then(cache => {
      return cache.match(event.request).then(cached => {
        if (cached) {
          // ✅ Stale-while-revalidate (não bloqueia)
          fetch(event.request).then(response => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(event.request, response);
            }
          }).catch(() => {});
          return cached;
        }

        return fetch(event.request).then(response => {
          // ✅ Só cacheia se for uma resposta válida
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            cache.put(event.request, responseClone);
          }
          return response;
        }).catch(() => {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#f0f7f2"/><text x="200" y="210" font-family="Arial" font-size="14" fill="#2f6b4f" text-anchor="middle">Imagem indisponível</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        });
      });
    })
  );
  return;
}

  // 🚫 NUNCA cacheia outros serviços externos
  if (
    url.includes('drive.google.com') ||
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
