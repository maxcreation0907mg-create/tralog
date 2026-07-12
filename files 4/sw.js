/* Tralog Service Worker
 * 方針:
 *  - ページ本体(navigate)はネットワーク優先 → 更新が即反映され、オフライン時のみキャッシュへフォールバック
 *  - CDNライブラリ・アイコン等の静的アセットはキャッシュ優先
 *  - バージョンを上げると古いキャッシュは activate 時に削除される
 */
const CACHE = 'tralog-v2.6.0';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // 1件失敗しても全体が失敗しないよう個別にadd
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // ページ遷移: ネットワーク優先(更新反映) → オフライン時はキャッシュ
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静的アセット: キャッシュ優先 → 無ければ取得してキャッシュ
  const url = new URL(req.url);
  const cacheable = url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com';
  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
