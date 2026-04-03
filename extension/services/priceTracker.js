// extension/services/priceTracker.js
// Exposes window.trackProductPrice and window.generateProductId as globals.

/**
 * generateProductId(url, title)
 *
 * Produces a STABLE identifier that is the same every time the user
 * opens the popup on the same product, regardless of URL query params,
 * ref tags, or minor title whitespace differences.
 *
 * Strategy (in priority order):
 *   1. Amazon  — extract the ASIN from /dp/XXXXXXXXXX/
 *   2. Flipkart — extract the item ID from /p/itm.../
 *   3. eBay    — extract item number from /itm/XXXXXXXXXX
 *   4. Etsy    — extract listing ID from /listing/XXXXXXXXXX
 *   5. Fallback — normalize the title (lowercase, strip noise, hash)
 */
function generateProductId(url, title) {
  if (url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const path = u.pathname;

      // Amazon: /dp/B09G9HD6PD  or  /gp/product/B09G9HD6PD
      if (host.includes('amazon')) {
        const asin = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
        if (asin) return 'amz_' + asin[1].toUpperCase();
      }

      // Flipkart: /product-name/p/itm1234abcd5678
      if (host.includes('flipkart')) {
        const itm = path.match(/\/p\/(itm[a-z0-9]+)/i);
        if (itm) return 'fk_' + itm[1].toLowerCase();
      }

      // eBay: /itm/123456789012
      if (host.includes('ebay')) {
        const itm = path.match(/\/itm\/(\d{10,})/);
        if (itm) return 'ebay_' + itm[1];
      }

      // Etsy: /listing/123456789/product-name
      if (host.includes('etsy')) {
        const listing = path.match(/\/listing\/(\d+)/);
        if (listing) return 'etsy_' + listing[1];
      }
    } catch (_) {
      // malformed URL — fall through to title-based ID
    }
  }

  // Fallback: normalize title to a stable string, then hash it
  const normalized = (title || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // strip punctuation
    .replace(/\s+/g, '_')           // spaces → underscores
    .substring(0, 60);              // cap length

  // Simple djb2-style hash so the ID is short and fixed-length
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return 'title_' + hash.toString(36);
}

/**
 * trackProductPrice({ productId, title, currentPrice })
 * Saves the current price to IndexedDB.
 */
async function trackProductPrice({ productId, title, currentPrice }) {
  try {
    await window.priceHistoryStorage.saveProductHistory(productId, title, currentPrice);
  } catch (err) {
    console.error('[PricePulse] trackProductPrice failed:', err);
  }
}

window.generateProductId = generateProductId;
window.trackProductPrice = trackProductPrice;
