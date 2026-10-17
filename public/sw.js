// عامل الخدمة: المصحف والخطوط والواجهة الأساسية تعمل دون اتصال بعد الزيارة الأولى (القسم 16).
// - ملفات البناء والخطوط والصور: من الذاكرة أولاً (أسماؤها تتغيّر مع كل إصدار).
// - صفحات المصحف: من الشبكة أولاً، ومن الذاكرة عند انقطاع الاتصال.
// بيانات الحساب والجداول لا تُخزَّن هنا حتى لا تظهر بيانات قديمة أو لمستخدم آخر.
const VERSION = 'maab-v3';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-mushaf`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// المسار الأساسي من نطاق التسجيل: «/» في النسخة الحية و«/maab/» على GitHub Pages
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const local = (url) => (url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || '/' : null);

const isStatic = (url) => {
  const p = local(url);
  return Boolean(p && (p.startsWith('/_next/static/') || p.startsWith('/brand/') || p.startsWith('/icons/') || p === '/data/ayahs.json'));
};

// الصفحات بشرطة ختامية في النسخة الثابتة (trailingSlash)
const isMushaf = (url) => /^\/(guardian|teacher)\/mushaf(\/\d+)?\/?$/.test(local(url) ?? '');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (isMushaf(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request, { ignoreVary: true }).then((hit) => hit || Response.error())),
    );
  }
});

// إشعارات الجهاز (Web Push): العنوان والنص والرابط من الخادم، وفي تطبيق
// أندرويد تظهر باسم التطبيق وأيقونته
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'مآب', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'مآب', {
      body: data.body || '',
      dir: 'rtl',
      lang: 'ar',
      icon: `${BASE}/icons/icon-192.png`,
      badge: `${BASE}/icons/badge-96.png`,
      tag: data.tag,
      data: { url: data.url || `${BASE}/` },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || `${BASE}/`, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        open.navigate(target).catch(() => null);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
