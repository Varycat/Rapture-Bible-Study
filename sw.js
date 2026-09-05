
const C='bible-study-library-v17';
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

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);

  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          const copy=r.clone();
          caches.open(C).then(c=>c.put('index.html',copy));
          return r;
        })
        .catch(()=>caches.match('index.html'))
    );
    return;
  }

  if(u.pathname.endsWith('/css/app.css') || u.pathname.endsWith('/js/app.js') || u.pathname.endsWith('/js/firebase-config.js')){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          const copy=r.clone();
          caches.open(C).then(c=>c.put(e.request,copy));
          return r;
        })
        .catch(()=>caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(r=>{
        const copy=r.clone();
        caches.open(C).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});
