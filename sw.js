// KCSI Photo Editor 모바일: 한 번 열면 인터넷 없이도 열리도록 앱 파일을 기기에 보관
const CACHE = "kcsi-v0.2-20";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"];
// 새 버전 설치 때는 브라우저 임시 보관본을 거치지 않고 서버에서 바로 받음
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// 앱 화면(index.html): 인터넷이 되면 최신본(3초 안에), 안 되면 보관본 / 그림 등: 보관본 먼저
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === "navigate";
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true }) || (page ? await c.match("./index.html") : undefined);
    const net = fetch(page ? new Request(req.url, { cache: "no-store" }) : req)
      .then((res) => { if (res.ok) c.put(page ? "./index.html" : req, res.clone()); return res; });
    if (page) {
      const timeout = new Promise((ok) => setTimeout(() => ok(null), 3000));
      const fresh = await Promise.race([net.catch(() => null), timeout]);
      if (fresh) return fresh;
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    }
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => c.match("./index.html"));
  }));
});
