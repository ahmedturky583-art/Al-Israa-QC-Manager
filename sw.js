const CACHE="alisraa-qc-shell-v6";
const ASSETS=["./","./index.html","./manifest.webmanifest","./assets/style.css","./assets/app.js","./assets/qc-engine.js","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return response}).catch(()=>caches.match("./index.html"))))});
