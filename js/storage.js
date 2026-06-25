(function (root) {
  'use strict';

  const STORAGE_KEY = 'dark_new_tab_sites';

  async function loadSites() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const encrypted = result[STORAGE_KEY];
      if (!encrypted) return [];
      const sites = await root.CryptoUtil.decrypt(encrypted);
      return Array.isArray(sites) ? sites : [];
    }

    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (!encrypted) return [];
    const sites = await root.CryptoUtil.decrypt(encrypted);
    return Array.isArray(sites) ? sites : [];
  }

  async function saveSites(sites) {
    const encrypted = await root.CryptoUtil.encrypt(sites);
    if (!encrypted) throw new Error('加密失败');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: encrypted });
    } else {
      localStorage.setItem(STORAGE_KEY, encrypted);
    }
  }

  root.Storage = { loadSites, saveSites };
})(typeof window !== 'undefined' ? window : self);
