// extension/services/priceTracker.js

import priceHistoryStorage from './priceHistoryStorage.js';

/**
 * Tracks price for a product by saving it to storage if conditions are met.
 * @param {Object} productInfo - The product information to track
 * @param {string} productInfo.productId
 * @param {string} productInfo.title
 * @param {number} productInfo.currentPrice
 */
export async function trackProductPrice(productInfo) {
  const { productId, title, currentPrice } = productInfo;

  try {
    await priceHistoryStorage.saveProductHistory(productId, title, currentPrice);
    console.log(`Price tracked for product: ${productId}`);
  } catch (error) {
    console.error('Failed to track product price:', error);
  }
}

/**
 * Generates a unique product ID from URL or title.
 * @param {string} url - The product URL
 * @param {string} title - The product title
 * @returns {string} A unique product ID
 */
export function generateProductId(url, title) {
  // Use URL as primary ID, or hash of title if URL not available
  if (url) {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }
  if (title) {
    return btoa(title).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }
  return 'unknown';
}