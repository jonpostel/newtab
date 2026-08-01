(function (root) {
  'use strict';

  const STORAGE_KEY = 'dark_new_tab_sites';

  // Prefer Firefox's `browser` namespace (Promise-based); fall back to
  // Chrome's `chrome` namespace. Both expose the same storage.local API.
  const extApi = (typeof browser !== 'undefined' && browser.storage && browser.storage.local)
    ? browser
    : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
      ? chrome
      : null;

  async function getStored(key) {
    if (extApi) {
      const result = await extApi.storage.local.get(key);
      return result[key];
    }
    return localStorage.getItem(key);
  }

  async function setStored(key, value) {
    if (extApi) {
      await extApi.storage.local.set({ [key]: value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  async function loadSites() {
    const encrypted = await getStored(STORAGE_KEY);
    if (!encrypted) return [];
    const sites = await root.CryptoUtil.decrypt(encrypted);
    return Array.isArray(sites) ? sites : [];
  }

  async function saveSites(sites) {
    const encrypted = await root.CryptoUtil.encrypt(sites);
    if (!encrypted) throw new Error('加密失败');
    await setStored(STORAGE_KEY, encrypted);
  }

  root.Storage = { loadSites, saveSites };
})(typeof window !== 'undefined' ? window : self);
