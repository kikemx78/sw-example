/** 
/* If this is the first time SW is installed ; 
/* all requests are handled by browser. SW has no reference
/* for this requests as they 'happen' on a different scope.
/*
/* Requests are handled by SW on the second visit after it 
/* has been installed. This time SW requests resources from
/* network and stores them inside the cache. This is where we 
/* can get a reference to build a progress bar and communicate 
/* that to browser.
/*
/* From the third visit on, SW serves cached assets if found ; 
/* or networks resource if it is not found in cache.
/*
/* If there is an update on CACHE_NAME (new code base version); 
/* ALL requests are networked by SW and responses stored inside cache. 
/* We can once again build a progress bar here. 
/*
**/

const CACHE_NAME = 'static-v6';

// scp -r ./sw-example/index.html kikemx78@157.245.218.106:/var/www/esanttests.com/html/sw-example
// scp -r ./sw-example/sw.js kikemx78@157.245.218.106:/var/www/esanttests.com/html/sw-example

// SW gives you an install event each time it is instantiated...

self.addEventListener('install', (event) => {

  console.log('install event');

  // // Register assets...

  // const urlsToCache = [
  //   '/public/js/app.js',
  //   '/public/js/vendor.js',
  //   '/public/css/main.css'
  // ];

  // // Add assets to cache

  // event.waitUntil(
  //   caches.open(CACHE_NAME)
  //     .then(function(cache) {
  //       console.log('adding assets to cache');
  //       return cache.addAll(urlsToCache);
  //     })
  // );

  // Always install updated SW immediately ; this also triggers activate event
  // deleting old assets

  console.log('skipWaiting installs update immediately')
  self.skipWaiting();
});

// If a request doesn't match anything in the cache, 
// get it from the network, send it to the page & add it to the cache at the same time.

self.addEventListener('fetch', function(event) {
  
  const url = new URL(event.request.url);
  const scope = self.registration.scope

  // Needs to be https...

  console.log('Checking resource requests....');

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          console.log('Cache hit - return cached response for ', url.href);
          broadcast({ type: 'CACHE_HIT', message:  url.href });
          return response;
        }

        console.log('Asset not in cache. Fetch resource from network ---', url.href);
        
        return fetch(event.request).then(
          function(response) {
            // Check if we received a valid response
            console.log('network request to ', url.href);
            if(!response || response.status !== 200 || response.type !== 'basic') {
              console.log('no valid response for ', url.href);
              console.log(response);
              return response;
            }

            console.log('request response status ok for...', url.href);

            broadcast({ type: 'NETWORKED', message:  url.href });
            console.log('emit progressbar event...');

            // Even if resource is not listed on urlsToCache ; we will
            // store it on cache.

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                console.log('Adding resource to cache..', event.request.url)
                broadcast({ type: 'ADDED_TO_CACHE', message:  url.href });
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});



// Once a new ServiceWorker has installed & a previous version isn't being used, 
// the new one activates, and you get an activate event. Time to delete old assets.

self.addEventListener('activate', (event) => {
  console.log('activate event');

  // White list the new cache version
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      console.log(cacheNames);
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('cache has beed updated ; delete old cache = ', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

});

function broadcast({ type, message }) {
  return self.clients.matchAll().then(function (clients) {
    clients.forEach(function (client) {
      
      client.postMessage(JSON.stringify({ type, message }));
    });
  })
}
