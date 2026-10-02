// オフライン対応（設計書 5.3）。
// - 画面（HTML）: まずネットから取得し、つながらなければ保存しておいたものを使う
// - /_next/static の JS・CSS とアイコン: ファイル名に版が入っているので、保存済みならそれを使う
// - 譜面のデータは IndexedDB にあるので、ここでは扱わない
const CACHE = 'chord-v1';
const PAGES = ['/', '/sheet', '/edit', '/new', '/settings', '/import'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const assets = new Set(['/manifest.webmanifest', '/icon-192.png']);
      for (const page of PAGES) {
        const res = await fetch(page, { cache: 'no-store' });
        if (!res.ok) continue;
        const html = await res.clone().text();
        await cache.put(page, res);
        // 画面が使う JS・CSS も先に保存しておく
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+/g)) assets.add(m[0]);
      }
      await Promise.all([...assets].map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function isStatic(url) {
  return url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          // ?id= などのクエリは画面の中身に関係しないので、パスだけで保存する
          if (res.ok && PAGES.includes(url.pathname)) cache.put(url.pathname, res.clone());
          return res;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match('/')) || Response.error();
        }
      })(),
    );
  }
});
