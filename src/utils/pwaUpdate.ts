export const APP_BUILD_TIME =
  typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : 'dev';

/**
 * Clear all PWA Service Worker caches and reload page bypassing cache.
 * Keeps LocalStorage (tasks, settings, history) completely untouched!
 */
export const clearPwaCacheAndReload = async (): Promise<void> => {
  // 1. Delete all CacheStorage entries
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (err) {
      console.warn('Failed to clear CacheStorage:', err);
    }
  }

  // 2. Unregister all active ServiceWorkers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    } catch (err) {
      console.warn('Failed to unregister ServiceWorkers:', err);
    }
  }

  // 3. Force clean reload with cache-busting timestamp query parameter
  const base = window.location.origin + window.location.pathname;
  window.location.href = `${base}?_pwa_refresh=${Date.now()}`;
};

/**
 * Prompt ServiceWorker to check for background updates (useful on app resume/focus)
 */
export const checkForServiceWorkerUpdate = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
      }
    } catch (err) {
      console.warn('ServiceWorker update check failed:', err);
    }
  }
};
