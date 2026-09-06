
const C='bible-study-library-v27';
const CORE=['./','index.html','css/app.css','js/app.js','js/firebase-config.js','data/studies.json','manifest.webmanifest','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// Stale-while-revalidate for same-origin GETs: answer instantly from cache,
// refresh the cache from the network in the background. Firestore/auth traffic
// (cross-origin, often POST/streaming) is never intercepted.
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;

  const key=e.request.mode==='navigate'?'index.html':e.request;
  e.respondWith(
    caches.match(key).then(cached=>{
      const fresh=fetch(e.request)
        .then(r=>{
          if(r&&r.ok){const copy=r.clone();caches.open(C).then(c=>c.put(key,copy))}
          return r;
        })
        .catch(()=>null);
      return cached||fresh.then(r=>r||caches.match('index.html'));
    })
  );
});
