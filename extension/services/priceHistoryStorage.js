// extension/services/priceHistoryStorage.js

class PriceHistoryStorage {
  constructor() {
    this.dbName = 'PriceHistoryDB';
    this.version = 1;
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'productId' });
        }
      };
    });
  }

  async saveProductHistory(productId, title, price) {
    const db = await this.openDB();
    const transaction = db.transaction(['products'], 'readwrite');
    const store = transaction.objectStore('products');

    // Get existing history
    const existing = await new Promise((resolve) => {
      const request = store.get(productId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });

    const now = Date.now();
    const newEntry = { price, timestamp: now };

    if (existing) {
      // Check if we need to add new entry
      const lastEntry = existing.prices[existing.prices.length - 1];
      const timeDiff = now - lastEntry.timestamp;
      const priceChanged = lastEntry.price !== price;
      const intervalMs = 6 * 60 * 60 * 1000; // 6 hours

      if (priceChanged || timeDiff >= intervalMs) {
        existing.prices.push(newEntry);
        store.put(existing);
      }
    } else {
      // New product
      const newHistory = {
        productId,
        title,
        prices: [newEntry]
      };
      store.add(newHistory);
    }

    db.close();
  }

  async getProductHistory(productId) {
    const db = await this.openDB();
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');

    return new Promise((resolve) => {
      const request = store.get(productId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async getAllProductHistories() {
    const db = await this.openDB();
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }
}

const priceHistoryStorage = new PriceHistoryStorage();
export default priceHistoryStorage;