// controllers/productController.js

import comparisonService from '../services/comparisonService.js';
import Product from '../models/Product.js';
import SearchHistory from '../models/SearchHistory.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { notFound, badRequest } from '../utils/ApiError.js';
import { extractProductInfo } from '../utils/urlParser.js';

/**
 * GET /api/products/search?q=query&page=1&limit=20&sort=price_asc&platform=Amazon,eBay
 * Main search endpoint — fetches and compares prices across all platforms.
 */
export const searchProducts = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20, sort = 'price_asc', platform } = req.query;

    // Fetch from comparison service (handles caching internally)
    const { products, meta } = await comparisonService.search(q, req.user?._id || null);

    // ── Platform filter ──────────────────────────────────────────────────────
    let filtered = products;
    if (platform) {
      const platforms = platform.split(',').map((p) => p.trim());
      filtered = products.filter((p) => platforms.includes(p.platform));
    }

    // ── Sorting ──────────────────────────────────────────────────────────────
    const sortMap = {
      price_asc:  (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      rating:     (a, b) => b.rating - a.rating,
      reviews:    (a, b) => b.reviews - a.reviews,
    };
    if (sortMap[sort]) filtered = [...filtered].sort(sortMap[sort]);

    // ── Pagination ───────────────────────────────────────────────────────────
    const pageNum   = Math.max(1, parseInt(page, 10));
    const limitNum  = Math.min(50, Math.max(1, parseInt(limit, 10))); // cap at 50
    const totalPages = Math.ceil(filtered.length / limitNum);
    const paginated  = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return sendSuccess(
      res,
      paginated,
      `Found ${filtered.length} results for "${q}"`,
      200,
      {
        query:        q,
        total:        filtered.length,
        page:         pageNum,
        limit:        limitNum,
        totalPages,
        hasNextPage:  pageNum < totalPages,
        hasPrevPage:  pageNum > 1,
        servedFromCache:  meta.servedFromCache,
        cheapestPrice:    meta.cheapestPrice,
        cheapestPlatform: meta.cheapestPlatform,
        priceRange:       meta.priceRange,
      }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id
 * Returns a single cached product by its MongoDB _id.
 */
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return next(notFound('Product not found'));
    return sendSuccess(res, product);
  } catch (err) {
    // Invalid ObjectId format
    if (err.name === 'CastError') return next(badRequest('Invalid product ID'));
    next(err);
  }
};

/**
 * GET /api/products/trending
 * Returns the top 10 most searched queries in the last 24 hours.
 */
export const getTrending = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    const trending = await SearchHistory.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$query', count: { $sum: 1 }, avgCheapestPrice: { $avg: '$cheapestPrice' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, query: '$_id', count: 1, avgCheapestPrice: { $round: ['$avgCheapestPrice', 2] } } },
    ]);

    return sendSuccess(res, trending, 'Trending searches', 200);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products/compare-link
 * Accepts a product URL, extracts the product name, then runs a full
 * cross-platform comparison using the existing comparisonService.
 *
 * Body: { url: "https://amazon.com/..." }
 *
 * Response:
 * {
 *   parsedProduct: { platform, name, originalUrl },
 *   products: [...],          // sorted comparison results
 *   meta: { ... }             // price stats
 * }
 */
export const compareLinkProducts = async (req, res, next) => {
  try {
    const { url } = req.body;

    // ── 1. Parse the URL ──────────────────────────────────────────────────────
    const parsed = extractProductInfo(url);

    if (!parsed.isValid) {
      return next(
        badRequest(
          parsed.platform === 'Unknown'
            ? 'Unsupported platform. Please use an Amazon, Flipkart, Etsy, or eBay URL.'
            : 'Could not extract a product name from this URL. Try searching by name instead.'
        )
      );
    }

    // ── 2. Run cross-platform comparison using the extracted name ─────────────
    // comparisonService.search already handles caching + history logging
    const { products, meta } = await comparisonService.search(
      parsed.name,
      req.user?._id || null
    );

    if (!products.length) {
      return next(notFound(`No comparison results found for "${parsed.name}"`));
    }

    // ── 3. Sort by price ascending and flag cheapest ──────────────────────────
    const sorted = [...products].sort((a, b) => a.price - b.price);
    sorted.forEach((p, i) => { p.isCheapest = i === 0; });

    // ── 4. Build price stats ──────────────────────────────────────────────────
    const prices  = sorted.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = +(prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2);

    return sendSuccess(
      res,
      {
        parsedProduct: {
          name:        parsed.name,
          platform:    parsed.platform,
          originalUrl: parsed.originalUrl,
        },
        products: sorted,
        meta: {
          ...meta,
          total:            sorted.length,
          extractedQuery:   parsed.name,
          sourcePlatform:   parsed.platform,
          cheapestPrice:    minPrice,
          cheapestPlatform: sorted[0]?.platform,
          priceRange:       { min: minPrice, max: maxPrice, avg: avgPrice },
        },
      },
      `Comparison results for "${parsed.name}"`,
      200
    );
  } catch (err) {
    next(err);
  }
};
