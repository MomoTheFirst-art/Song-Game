/**
 * Minimal service worker: present so the app is installable, deliberately not
 * a cache layer.
 *
 * Chrome will not offer to install a site without one that handles fetch. That
 * is the only reason this exists. It must stay network-first, because the
 * catalogue's preview URLs expire and a cached build would keep serving links
 * that no longer resolve — silently, on a device with no way to clear it.
 *
 * Audio is never touched here. Previews stream from Apple's CDN and caching
 * them would both break on expiry and store what the terms say not to store.
 */
const CACHE = 'shell-v1'

self.addEventListener('install', (event) => {
  // Only the entry point, and only as an offline fallback.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add('./')).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  // Everything but page loads goes straight to the network, untouched.
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Keep the fallback current so an offline launch is not months stale.
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put('./', copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match('./')),
  )
})
