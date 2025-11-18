// ================================================
// SERVICE-WORKER.JS (COMPLETE & FINAL)
// ================================================

const CACHE_NAME = 'orli-static-v1';
const OFFLINE_URL = '/offline.html';
const ROLE_AUTH_PATH = '/role-auth.js';

// Files to pre-cache (offline shell)
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  ROLE_AUTH_PATH,
  '/styles.css',
  '/favicon.ico'
];

// Utility to determine if response is HTML
function isHtmlResponse(headers) {
  const ct = headers.get('content-type') || '';
  return ct.includes('text/html');
}

// Quick heuristic: treat paths containing year[1-6], y[1-6], teacher, student as protected
function isProtectedPath(pathname) {
  return /year[1-6]|\by[1-6]\b|teacher|student/.test(pathname.toLowerCase());
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Inject role-auth script into HTML pages so you don't have to edit each page manually
async function injectRoleAuthIntoHtml(text) {
  const scriptTag = `\n<script src="${ROLE_AUTH_PATH}" async></script>\n`;
  if (/<head[\s\S]*?>/i.test(text)) {
    return text.replace(/<head(\b[^>]*)>/i, (m) => m + scriptTag);
  }
  if (/<body[\s\S]*?>/i.test(text)) {
    return text.replace(/<body(\b[^>]*)>/i, (m) => m + scriptTag);
  }
  return scriptTag + text;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Network-first for HTML pages (so role-auth injection can work)
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const networkResp = await fetch(req);
        if (!networkResp || !networkResp.ok) throw new Error('Network fetch failed');

        const cloned = networkResp.clone();
        const text = await cloned.text();

        // If role-auth already present, return original
        if (text.includes(ROLE_AUTH_PATH)) {
          // Cache non-protected pages
          if (!isProtectedPath(url.pathname)) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, networkResp.clone());
          }
          return networkResp;
        }

        // Inject and optionally cache
        const injected = await injectRoleAuthIntoHtml(text);
        const responseHeaders = new Headers(networkResp.headers);
        responseHeaders.set('Content-Length', String(new Blob([injected]).size));

        const response = new Response(injected, {
          status: networkResp.status,
          statusText: networkResp.statusText,
          headers: responseHeaders
        });

        if (!isProtectedPath(url.pathname)) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, response.clone()).catch(() => {});
        }

        return response;
      } catch (err) {
        // Offline fallback
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        const offline = await cache.match(OFFLINE_URL);
        return offline || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
      }
    })());
    return;
  }

  // For other requests, try cache then network
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const resp = await fetch(req);
      // Cache static assets (images, css, js) for performance
      if (resp && resp.ok && /\.(js|css|png|jpg|jpeg|svg|woff2?|ico)$/.test(url.pathname)) {
        cache.put(req, resp.clone()).catch(() => {});
      }
      return resp;
    } catch (e) {
      return new Response('Network error', { status: 408 });
    }
  })());
});
