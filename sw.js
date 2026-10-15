/* 巴士報站器 — app shell.
   重要：HTML/導航一律「網絡優先」，否則改版後用戶永遠拿到舊頁（SW cache-first 陷阱）。
   ETA 實時請求一律直上網，唔快取。 */
var CACHE = "buseta-shell-v2";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
function isRealtime(u){
  return u.hostname.indexOf("etabus.gov.hk") >= 0 || u.hostname.indexOf("data.gov.hk") >= 0;
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var u = new URL(req.url);
  if(isRealtime(u)) return;                       // 實時 ETA：唔攔截
  if(u.origin !== self.location.origin) return;

  var isDoc = (req.mode === "navigate") || req.destination === "document" ||
              /\.html$/.test(u.pathname) || u.pathname.endsWith("/");

  if(isDoc){
    // 網絡優先：拿到新頁就更新快取；斷網先用快取
    e.respondWith(
      fetch(req).then(function(res){
        var cp = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, cp); });
        return res;
      }).catch(function(){
        return caches.match(req, {ignoreSearch:true}).then(function(hit){ return hit || caches.match("./index.html"); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, {ignoreSearch:true}).then(function(hit){
      return hit || fetch(req).then(function(res){
        var cp = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, cp); });
        return res;
      });
    })
  );
});
