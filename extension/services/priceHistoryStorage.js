// extension/services/priceHistoryStorage.js
// Uses chrome.storage.local so history persists across popup sessions.

const MAX_ENTRIES = 90;

function _storageKey(title, platform) {
  return 'ph_' + (title + '_' + platform).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 80);
}

async function savePrice({ title, price, platform, url, date }) {
  if (!title || price == null) return;
  const key = _storageKey(title, platform);
  const stored = await new Promise(resolve =>
    chrome.storage.local.get(key, r => resolve(r[key] || []))
  );
  stored.push({ title, price, platform, url, date: date || new Date().toISOString().split('T')[0] });
  const trimmed = stored.slice(-MAX_ENTRIES);
  await new Promise(resolve => chrome.storage.local.set({ [key]: trimmed }, resolve));
}

async function getHistory(title, platform) {
  const key = _storageKey(title, platform);
  return new Promise(resolve =>
    chrome.storage.local.get(key, r => resolve(r[key] || []))
  );
}

window.priceHistoryStorage = { savePrice, getHistory };
