const CACHE_NAME = 'wr-aroma-v1';
const urlsToCache = [
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/assets/Logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(urlsToCache.map(url => cache.add(url).catch(err => console.warn('⚠️ Falha ao cachear:', url, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cache => {
        if (cache !== CACHE_NAME) return caches.delete(cache);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (event.request.method !== 'GET') return;

  if (
    event.request.mode === 'navigate' ||
    url.endsWith('.html') ||
    url.endsWith('/') ||
    url.includes('index.html') ||
    url.includes('login.html') ||
    url.includes('admin.html')
  ) return;

  if (
    url.includes('googleusercontent.com') ||
    url.includes('drive.google.com') ||
    url.includes('cdn.tailwindcss.com') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('script.google.com') ||
    url.includes('docs.google.com') ||
    url.includes('wa.me')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
