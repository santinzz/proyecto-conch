// Service worker mínimo de EcoPuntos.
// - Permite instalar la app y muestra /offline.html si no hay conexión al abrir una página.
// - NO guarda en caché páginas ni respuestas de la API: el saldo, la sesión y los
//   QR siempre vienen del servidor, para no mostrar datos viejos.
const CACHE = "ecopuntos-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
