// Installable app: offline cache (only on the real site, never inside a frame)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && window.top === window) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
