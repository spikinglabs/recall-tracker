// Allo Recalls service worker: makes the site installable and keeps the list readable offline.
// Same approach as Allo Outings (spikinglabs/little-outings, public/sw.js).
//   pages        → a copy saved in the last 12 hours opens at once and is refreshed in the background;
//                  otherwise network first, falling back after 3 s to the older copy
//                  (the fresh one still lands in the cache for next time).
//                  A saved page is only reused while the styles and scripts it names are saved too.
//   /assets/ (fonts included), /icons/ → cache first (Vite's file names change when the content does).
//                  Only real CSS/JS/images are kept: the host answers a missing old file with an HTML page.
//   the recall data (recalls-api.allo.land, the old r2.dev bucket) → network first, the last copy after
//                  4 s or when offline, so an installed app still shows the list without a connection.
//   anything else, and anything not GET → straight to the network, never cached
const VERSION = "v1";
const FRESH_MS = 12 * 60 * 60 * 1000;
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const DATA = `data-${VERSION}`;
const MAX_PAGES = 60;
const DATA_HOSTS = ["recalls-api.allo.land", "pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = [PAGES, STATIC, DATA];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (DATA_HOSTS.includes(url.hostname)) return event.respondWith(data(req, event));
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate" || url.pathname.endsWith("/")) {
    event.respondWith(networkFirst(req, url, event));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && !isHtml(res)) cache.put(req, res.clone());
  return res;
}

async function data(req, event) {
  const cache = await caches.open(DATA);
  const fresh = fetch(req).then((res) => {
    if (res.ok) event.waitUntil(cache.put(req, res.clone()));
    return res;
  });
  event.waitUntil(fresh.catch(() => {}));
  const cached = await cache.match(req);
  if (!cached) return fresh;
  const slow = new Promise((ok) => setTimeout(ok, 4000, cached));
  return Promise.race([fresh.catch(() => cached), slow]);
}

const isHtml = (res) => (res.headers.get("content-type") || "").includes("text/html");
// The /assets/ files a page links to; their names change with every build that changes them.
const assetsOf = (html) => [...new Set(html.match(/\/assets\/[^"'\s)]+\.(?:css|js)/g) || [])];

/** True when every style and script the saved page names is saved too, so it can render on its own. */
async function complete(page) {
  const statics = await caches.open(STATIC);
  for (const a of assetsOf(await page.clone().text())) if (!(await statics.match(a))) return false;
  return true;
}

/** Saves the styles and scripts a freshly fetched page names, so its saved copy works later. */
async function saveAssets(page) {
  const statics = await caches.open(STATIC);
  for (const a of assetsOf(await page.text())) {
    if (await statics.match(a)) continue;
    const res = await fetch(a).catch(() => null);
    if (res && res.ok && !isHtml(res)) await statics.put(a, res);
  }
}

async function networkFirst(req, url, event) {
  const cache = await caches.open(PAGES);
  const fresh = fetch(req).then(async (res) => {
    if (res.ok && res.type === "basic") {
      await cache.put(req, res.clone());
      if (isHtml(res)) event.waitUntil(saveAssets(res.clone()).catch(() => {}));
      trim(cache);
    }
    return res;
  });
  try {
    // ?q=, ?r= and shared listings all open the same page; the app reads the address itself.
    let cached = await cache.match(req, { ignoreSearch: true });
    // A copy from an older build whose styles are gone would show up unstyled: wait for the network.
    if (cached && !(await complete(cached))) cached = undefined;
    if (!cached) return await fresh;
    // The list changes once a day, so a recent copy is good enough to show right away.
    const age = Date.now() - Date.parse(cached.headers.get("date") || "");
    event.waitUntil(fresh.catch(() => {}));
    if (age < FRESH_MS) return cached;
    const slow = new Promise((ok) => setTimeout(ok, 3000, cached));
    return await Promise.race([fresh, slow]);
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") {
      // Offline on a page you haven't opened yet: show the start page in your language, if we have it.
      const dir = (url.pathname.match(/^\/(de|es|fr|zh)\//) || [])[1];
      const home = (dir && (await cache.match(`/${dir}/`))) || (await cache.match("/"));
      if (home) return home;
      return new Response(OFFLINE, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
    }
    throw err;
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(key);
}

const OFFLINE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Allo Recalls</title><style>body{font:1.05rem/1.5 system-ui,sans-serif;background:#f6f5f2;color:#17191b;margin:0;padding:48px 20px;text-align:center}
b{display:inline-block;background:#ffcc00;padding:4px 10px;border-radius:8px;margin-bottom:12px}</style></head>
<body><b>Allo Recalls · 小鹿召回</b><p>You're offline. Please try again later.<br>Offline. Bitte später nochmal versuchen.<br>当前离线，请稍后再试。</p></body></html>`;
