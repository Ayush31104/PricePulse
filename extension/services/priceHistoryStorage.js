// extension/services/priceHistoryStorage.js
// Exposes window.priceHistoryStorage as a global for popup.js to use.

class PriceHistoryStorage {
  constructor() {
    this.dbName  = 'PriceHistoryDB';
    this.version = 1;
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror         = () => reject(request.error);
      request.onsuccess       = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'productId' });
        }
      };
    });
  }

  async saveProductHistory(productId, title, price) {
    const db          = await this.openDB();
    const transaction = db.transaction(['products'], 'readwrite');
    const store       = transaction.objectStore('products');

    const existing = await new Promise((resolve) => {
      const req = store.get(productId);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(undefined);
    });

    const now       = Date.now();
    const todayDate = new Date(now).toISOString().split('T')[0];

    if (existing) {
      const last         = existing.prices[existing.prices.length - 1];
      const lastDate     = new Date(last.timestamp).toISOString().split('T')[0];
      const priceChanged = last.price !== price;
      const isNewDay     = lastDate !== todayDate;

      // Record if price changed or it's a new day
      if (priceChanged || isNewDay) {
        existing.prices.push({ price, timestamp: now });
        store.put(existing);
      }
    } else {
      store.add({ productId, title, prices: [{ price, timestamp: now }] });
    }

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror    = () => reject(transaction.error);
    });

    db.close();
  }

  async getProductHistory(productId) {
    const db          = await this.openDB();
    const transaction = db.transaction(['products'], 'readonly');
    const store       = transaction.objectStore('products');

    return new Promise((resolve) => {
      const req = store.get(productId);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror   = () => { db.close(); resolve(null); };
    });
  }
}

window.priceHistoryStorage = new PriceHistoryStorage();
