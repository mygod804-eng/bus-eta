/* 巴士報站器 — app shell cache. ETA 請求一律走網絡（唔可以快取）。 */
var CACHE = "buseta-shell-v1";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  var u = new URL(e.request.url);
  if(e.request.method !== "GET") return;
  if(u.hostname.indexOf("etabus.gov.hk") >= 0 || u.hostname.indexOf("data.gov.hk") >= 0) return; // 實時資料：直接上網
  if(u.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, {ignoreSearch:true}).then(function(hit){
      return hit || fetch(e.request).then(function(res){
        var cp = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, cp); });
        return res;
      }).catch(function(){ return caches.match("./index.html"); });
    })
  );
});
