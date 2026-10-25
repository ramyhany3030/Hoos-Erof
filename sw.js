/* يخزّن الصفحة ومكتبة الكاميرا ليفتح النظام حتى لو النت مقطوع (بعد أول فتح بالإنترنت).
 * v3.7+: كل طلب للصفحة يُراجَع مع الخادم (no-cache) بدل الاعتماد على كاش المتصفح (GitHub Pages يخزّن الملفات 10 دقائق)،
 * فلا تبقى نسخة قديمة من index.html أو config.js على الكمبيوتر. ولو الشبكة بطيئة/مقطوعة تُعرض النسخة المحفوظة. */
var CACHE = 'att-shell-v4-1';
var CDN = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
var SHELL = ['./', './index.html', './config.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    var jobs = SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); });
    jobs.push(c.add(CDN).catch(function () {}));
    return Promise.all(jobs);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// مفتاح التخزين بدون ?query حتى لا تتراكم نسخ بعدد مرات الفتح
function keyOf(url) { return new Request(url.origin + url.pathname); }

function putCopy(key, res) {
  if (res && res.ok && res.type !== 'opaqueredirect') { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, cp); }); }
  return res;
}

// الصفحة وملفاتها: الشبكة أولًا مع مراجعة الخادم دائمًا، ولو بطيئة (4 ثوانٍ) أو مقطوعة تُعرض النسخة المحفوظة
function networkFirst(req, key) {
  return new Promise(function (resolve) {
    var done = false;
    function fromCache(fallbackError) {
      caches.match(key).then(function (hit) {
        if (done) return;
        if (hit) { done = true; resolve(hit); }
        else if (fallbackError) { done = true; resolve(Response.error()); }
      });
    }
    var t = setTimeout(function () { fromCache(false); }, 4000);
    fetch(req, { cache: 'no-cache' }).then(function (res) { clearTimeout(t); putCopy(key, res); if (!done) { done = true; resolve(res); } })
      .catch(function () { clearTimeout(t); fromCache(true); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (req.url === CDN) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { return putCopy(req, res); });
    }));
    return;
  }
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req, keyOf(url)));
});
