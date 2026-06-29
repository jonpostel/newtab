(function (root) {
  'use strict';

  const PASSPHRASE = 'DarkNewTab_SecretKey_2024';

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

  let cachedKeyPromise = null;

  async function deriveKey() {
    // Key derivation (PBKDF2 100k iterations) is expensive.
    // Passphrase & salt are constants, so cache the derived key promise.
    if (!cachedKeyPromise) {
      cachedKeyPromise = (async () => {
        const keyMaterial = await root.crypto.subtle.importKey(
          'raw',
          stringToBytes(PASSPHRASE),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
        return root.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: stringToBytes('DarkNewTab_Salt'),
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      })();
    }
    return cachedKeyPromise;
  }

  async function encrypt(plaintext) {
    try {
      const key = await deriveKey();
      const iv = root.crypto.getRandomValues(new Uint8Array(12));
      const encoded = stringToBytes(JSON.stringify(plaintext));
      const ciphertext = await root.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
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

  async function decrypt(cipherBase64) {
    try {
      const key = await deriveKey();
      const combined = base64ToBytes(cipherBase64);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await root.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      return JSON.parse(bytesToString(new Uint8Array(decrypted)));
    } catch (e) {
      console.error('解密失败', e);
      return null;
    }
  }

  root.CryptoUtil = { encrypt, decrypt };
})(typeof window !== 'undefined' ? window : self);
