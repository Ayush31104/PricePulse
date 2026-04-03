// ============================================================
// services/comparisonService.js — Core price comparison engine
// ============================================================
// This is the heart of the backend. When a search query comes in,
// this service:
//   1. Checks an in-memory cache to avoid redundant scraping
//   2. Fetches the live USD→INR exchange rate
//   3. Scrapes Amazon India and Flipkart IN PARALLEL
//   4. Normalises all prices to INR
//   5. Sorts results cheapest-first and calculates price stats
//   6. Saves the search to history (if user is logged in)
//   7. Caches the result for future requests

import amazonService   from './amazonService.js';
import flipkartService from './flipkartService.js';
import ebayService     from './ebayService.js';
import etsyService     from './etsyService.js';
import { getUsdToInrRate, usdToInr } from '../utils/currencyConverter.js';
import SearchHistory from '../models/SearchHistory.js';
import { rankProducts, filterProducts } from '../utils/rankProducts.js';

// Cache TTL: read from .env (CACHE_TTL_MINUTES), default 10 minutes
const CACHE_TTL_MS = (parseInt(process.env.CACHE_TTL_MINUTES, 10) || 10) * 60 * 1000;

// In-memory cache stored as a Map: { queryKey → { data, ts } }
// This lives in RAM so it resets when the server restarts.
// For production, consider Redis for a persistent shared cache.
const _cache = new Map();

class ComparisonService {
  /**
   * search(query, userId)
   *
   * @param {string}      query  — the product name to search for
   * @param {string|null} userId — MongoDB user ID (null for anonymous users)
   * @returns {{ products: Product[], meta: object }}
   */
  async search(query, userId = null) {
    const key = query.toLowerCase().trim();

    // ── Cache check ──────────────────────────────────────────────────────────
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return { ...cached.data, meta: { ...cached.data.meta, servedFromCache: true } };
    }

    // ── Exchange rate ────────────────────────────────────────────────────────
    const inrRate = await getUsdToInrRate();

    // ── Parallel scraping — all 4 platforms ──────────────────────────────────
    // Promise.allSettled ensures one failing scraper never blocks the others
    const [amazonRes, flipkartRes, ebayRes, etsyRes] = await Promise.allSettled([
      amazonService.search(query),
      flipkartService.search(query),
      ebayService.search(query),
      etsyService.search(query),
    ]);

    const errors = [];

    const fromAmazon   = amazonRes.status   === 'fulfilled' ? amazonRes.value   : (errors.push(`Amazon: ${amazonRes.reason?.message}`),   []);
    const fromFlipkart = flipkartRes.status === 'fulfilled' ? flipkartRes.value : (errors.push(`Flipkart: ${flipkartRes.reason?.message}`), []);
    const fromEbay     = ebayRes.status     === 'fulfilled' ? ebayRes.value     : (errors.push(`eBay: ${ebayRes.reason?.message}`),         []);
    const fromEtsy     = etsyRes.status     === 'fulfilled' ? etsyRes.value     : (errors.push(`Etsy: ${etsyRes.reason?.message}`),         []);

    console.log(`[Search] "${query}" — Amazon:${fromAmazon.length} Flipkart:${fromFlipkart.length} eBay:${fromEbay.length} Etsy:${fromEtsy.length}`);
    if (errors.length) console.warn('[Search] Partial errors:', errors);

    // ── Price normalisation ──────────────────────────────────────────────────
    const normalise = (product) => ({
      ...product,
      price:    product.currency === 'INR' ? product.price : usdToInr(product.price, inrRate),
      currency: 'INR',
      url:      product.url || product.productUrl || '',
    });

    const allProducts = [
      ...fromAmazon.map(normalise),
      ...fromFlipkart.map(normalise),
      ...fromEbay.map(normalise),
      ...fromEtsy.map(normalise),
    ];

    // ── Relevance filter — remove clearly unrelated products ─────────────────
    const relevant = filterProducts(allProducts, query);
    console.log(`[Search] "${query}" — ${allProducts.length} raw → ${relevant.length} after filter`);

    const products = rankProducts(relevant, query).slice(0, 20);

    // ── Price statistics ─────────────────────────────────────────────────────
    const prices = products.map((p) => p.price);
    const cheapestPrice    = prices.length ? Math.min(...prices) : null;
    // Find cheapest platform by price (not by rank position)
    const cheapestProduct  = products.reduce((min, p) => (!min || p.price < min.price ? p : min), null);
    const cheapestPlatform = cheapestProduct?.platform || null;
    const priceRange       = prices.length ? {
      min: cheapestPrice,
      max: Math.max(...prices),
      avg: +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
    } : null;

    // ── Search history ───────────────────────────────────────────────────────
    if (userId && products.length) {
      SearchHistory.create({ user: userId, query, resultCount: products.length, cheapestPrice }).catch(() => {});
    }

    // ── Active platforms (only those that returned results) ──────────────────
    const activePlatforms = [...new Set(products.map((p) => p.platform))];

    const result = {
      products,
      meta: {
        query,
        total:            products.length,
        platforms:        activePlatforms,
        currency:         'INR',
        exchangeRate:     inrRate,
        cheapestPrice,
        cheapestPlatform,
        priceRange,
        servedFromCache:  false,
        fetchedAt:        new Date().toISOString(),
        ...(errors.length && { partialErrors: errors }),
      },
    };

    _cache.set(key, { data: result, ts: Date.now() });
    return result;
  }
}

const comparisonService = new ComparisonService();
export default comparisonService;
