(function (root) {
  'use strict';

  /* ============================================================
   * Non-extractable key encryption
   *
   * The AES-256-GCM key is generated with extractable=false, so its raw
   * bytes can NEVER be read by JavaScript (crypto.subtle.exportKey throws).
   * It is stored as a CryptoKey object in IndexedDB. Even if malware reads
   * the IndexedDB database files from disk, it cannot extract usable key
   * material.
   * ============================================================ */

  const DB_NAME = 'dark_new_tab_crypto';
  const STORE_NAME = 'keys';
  const KEY_ID = 'mainKey';

  let cachedKey = null;
  let initPromise = null;

  /* ------------------------------------------------------------- Helpers */
  function stringToBytes(str) {
    return new TextEncoder().encode(str);
  }

  function bytesToString(bytes) {
    return new TextDecoder().decode(bytes);
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /* --------------------------------------------------------- IndexedDB */
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(key, KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY_ID);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /* ----------------------------------------------------------- Init (once) */
  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      let key = await idbGet();
      if (!key) {
        // First use: generate a fresh non-extractable AES-256-GCM key.
        // extractable=false => exportKey() will throw; raw bytes never
        // leave the browser's crypto subsystem.
        key = await root.crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        await idbPut(key);
      }
      cachedKey = key;
    })();
    return initPromise;
  }

  /* --------------------------------------------------------------- Encrypt */
  async function encrypt(plaintext) {
    try {
      await init();
      const iv = root.crypto.getRandomValues(new Uint8Array(12));
      const encoded = stringToBytes(JSON.stringify(plaintext));
      const ciphertext = await root.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cachedKey,
        encoded
      );
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return bytesToBase64(combined);
    } catch (e) {
      console.error('加密失败', e);
      return null;
    }
  }

  /* --------------------------------------------------------------- Decrypt */
  async function decrypt(cipherBase64) {
    try {
      await init();
      const combined = base64ToBytes(cipherBase64);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await root.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cachedKey,
        ciphertext
      );
      return JSON.parse(bytesToString(new Uint8Array(decrypted)));
    } catch (e) {
      console.error('解密失败', e);
      return null;
    }
  }

  root.CryptoUtil = { encrypt, decrypt, init };
})(typeof window !== 'undefined' ? window : self);
