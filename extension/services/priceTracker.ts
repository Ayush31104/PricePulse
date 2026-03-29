// extension/services/priceTracker.ts

import priceHistoryStorage from './priceHistoryStorage.js';

export interface ProductInfo {
  productId: string;
  title: string;
  currentPrice: number;
}

/**
 * Tracks price for a product by saving it to storage if conditions are met.
 * @param productInfo - The product information to track
 */
export async function trackProductPrice(productInfo: ProductInfo): Promise<void> {
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
 * @param url - The product URL
 * @param title - The product title
 * @returns A unique product ID
 */
export function generateProductId(url: string, title?: string): string {
  // Use URL as primary ID, or hash of title if URL not available
  if (url) {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }
  if (title) {
    return btoa(title).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }
  return 'unknown';
}