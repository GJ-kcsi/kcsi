// KCSI Docs: 한 번 열면 인터넷 없이도 열리도록 앱 파일을 기기에 보관
const CACHE = "kcsi-v0.2-106";
const FILES = ["./", "./index.html", "./fingerprint.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"];
// 새 버전 설치 때는 브라우저 임시 보관본을 거치지 않고 서버에서 바로 받음
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== "kcsi-share").map((k) => caches.delete(k)))));
  self.clients.claim();
});
// 앱 화면(index.html): 인터넷이 되면 최신본(3초 안에), 안 되면 보관본 / 그림 등: 보관본 먼저
self.addEventListener("fetch", (e) => {
  const req = e.request;
  // 녹음 앱 등에서 '공유'로 보낸 받아쓰기 글: 서버로 보내지 않고 기기 안에 넣어 둔 뒤 앱을 염
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      let t = "";
      try {
        const fd = await req.formData();
        const txt = fd.get("text"), ttl = fd.get("title");
        let ft = "";
        for (const f of fd.getAll("file")) if (f && f.text) ft += (ft ? "\n" : "") + (await f.text());
        t = [typeof txt === "string" ? txt.trim() : "", ft.trim()].filter(Boolean).join("\n")
          || (typeof ttl === "string" ? ttl : "");                                // 제목(파일 이름 등)은 본문이 없을 때만
      } catch (err) {}
      const c = await caches.open("kcsi-share");
      await c.put("./__share", new Response(t));
      return Response.redirect("./?share=1", 303);
    })());
    return;
  }
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === "navigate";
  const path = new URL(req.url).pathname;
  const key = page && /\/(index\.html)?$/.test(path) ? "./index.html" : (page ? new Request(new URL(req.url).origin + path) : req);  // 지문 채취(fingerprint.html) 등 다른 화면은 각자 보관
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key, { ignoreSearch: true }) || (page ? await c.match("./index.html") : undefined);
    const net = fetch(page ? new Request(req.url, { cache: "no-store" }) : req)
      .then((res) => { if (res.ok) c.put(key, res.clone()); return res; });
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
