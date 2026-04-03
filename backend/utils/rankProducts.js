// utils/rankProducts.js
// ─────────────────────────────────────────────────────────────────────────────
// Relevance-first ranking for product search results.
//
// Problem this solves:
//   A search for "Apple iPhone 13" used to return cheap Oppo/Vivo phones first
//   because results were sorted purely by price. Users want the SAME brand and
//   model first, then similar products, then alternatives.
//
// Scoring system (higher = shown first):
//   +70  exact model match   — every significant query word found in the title
//   +50  same brand          — brand extracted from query matches brand in title
//   +30  partial name match  — at least half the query words appear in the title
//   + 0  everything else     — shown last as "Other Alternatives"
//   + price factor           — within the same tier, cheaper items rank higher
//                              (scaled 0–10 so it never overrides relevance)
//
// matchGroup values attached to each product (used by the extension UI):
//   "exact"       → "Best Match"
//   "same-brand"  → "Same Brand"
//   "similar"     → "Similar Products"
//   "other"       → "Other Alternatives"
// ─────────────────────────────────────────────────────────────────────────────

// Known brands — ordered longest-first so "OnePlus" matches before "One"
const KNOWN_BRANDS = [
  'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Redmi', 'Realme', 'Oppo', 'Vivo',
  'Motorola', 'Nokia', 'Sony', 'LG', 'Huawei', 'Honor', 'Asus', 'Lenovo',
  'HP', 'Dell', 'Acer', 'MSI', 'Razer', 'Microsoft', 'Google', 'Nothing',
  'iQOO', 'Tecno', 'Infinix', 'Lava', 'Micromax', 'Bosch', 'Philips',
  'Panasonic', 'Whirlpool', 'Godrej', 'Haier', 'Voltas', 'Daikin', 'LG',
  'Nike', 'Adidas', 'Puma', 'Reebok', 'Bata', 'Woodland',
].sort((a, b) => b.length - a.length); // longest first for greedy matching

/**
 * extractBrand(title)
 * Returns the first known brand found in the title (case-insensitive),
 * or null if no known brand is detected.
 *
 * Examples:
 *   "Apple iPhone 13 (128 GB)"  → "Apple"
 *   "Samsung Galaxy S23 Ultra"  → "Samsung"
 *   "Generic USB Cable"         → null
 */
export function extractBrand(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    // Use word-boundary-like check: brand must appear as a whole word
    const idx = lower.indexOf(brand.toLowerCase());
    if (idx === -1) continue;
    const before = lower[idx - 1];
    const after  = lower[idx + brand.length];
    const wordBefore = !before || /\W/.test(before);
    const wordAfter  = !after  || /\W/.test(after);
    if (wordBefore && wordAfter) return brand;
  }
  return null;
}

/**
 * normalizeTitle(str)
 * Lowercases and strips punctuation/extra spaces for reliable comparison.
 */
function normalizeTitle(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * queryWords(query)
 * Splits the query into significant words (length > 1, not stop-words).
 */
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'in', 'of', 'a', 'an', 'gb', 'tb', 'mb']);
function queryWords(query) {
  return normalizeTitle(query)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * scoreProduct(product, query)
 * Returns { score, matchGroup } for a single product against the search query.
 *
 * matchGroup: "exact" | "same-brand" | "similar" | "other"
 */
export function scoreProduct(product, query) {
  const productTitle = normalizeTitle(product.name || product.title || '');
  const words        = queryWords(query);
  const queryBrand   = extractBrand(query);
  const productBrand = extractBrand(product.name || product.title || '');

  if (!words.length) return { score: 0, matchGroup: 'other' };

  // Count how many query words appear in the product title
  const matchCount = words.filter((w) => productTitle.includes(w)).length;
  const matchRatio = matchCount / words.length;

  let score      = 0;
  let matchGroup = 'other';

  if (matchRatio === 1) {
    // Every query word found → exact / best match
    score      = 70;
    matchGroup = 'exact';
  } else if (
    queryBrand &&
    productBrand &&
    queryBrand.toLowerCase() === productBrand.toLowerCase()
  ) {
    // Same brand, even if model differs
    score      = 50;
    matchGroup = 'same-brand';
  } else if (matchRatio >= 0.5) {
    // At least half the words match → similar product
    score      = 30;
    matchGroup = 'similar';
  }
  // else score stays 0, matchGroup stays "other"

  // Price factor: cheaper items get up to +10 within the same tier.
  // We'll normalise this after we know the price range (done in rankProducts).
  return { score, matchGroup, price: product.price };
}

/**
 * filterProducts(products, query)
 *
 * Removes clearly irrelevant products before ranking.
 * Rules:
 *   1. If query has a known brand, drop products whose detected brand is
 *      a DIFFERENT known brand (e.g. query="iPhone" drops OnePlus).
 *      Products with no detectable brand are kept (accessories, generics).
 *   2. If query has 2+ significant words, drop products with zero keyword
 *      overlap.
 *
 * Safety net: if filtering leaves fewer than 3 results, returns the
 * original array unchanged (guards against sparse scraper results).
 */
export function filterProducts(products, query) {
  const queryBrand = extractBrand(query);
  const words      = queryWords(query);

  if (!queryBrand && words.length < 2) return products;

  const filtered = products.filter((p) => {
    const title        = normalizeTitle(p.name || p.title || '');
    const productBrand = extractBrand(p.name || p.title || '');

    // Rule 1: brand mismatch
    if (queryBrand && productBrand &&
        productBrand.toLowerCase() !== queryBrand.toLowerCase()) {
      console.log(`[Filter] Dropped brand mismatch: "${p.name || p.title}" (${productBrand} ≠ ${queryBrand})`);
      return false;
    }

    // Rule 2: zero keyword overlap for multi-word queries
    if (words.length >= 2) {
      const matchCount = words.filter((w) => title.includes(w)).length;
      if (matchCount === 0) {
        console.log(`[Filter] Dropped zero-match: "${p.name || p.title}"`);
        return false;
      }
    }

    return true;
  });

  return filtered.length >= 3 ? filtered : products;
}

/**
 * rankProducts(products, query)
 * Scores every product, attaches matchGroup, then sorts by:
 *   1. Relevance score (desc)
 *   2. Price (asc) within the same score tier
 *
 * Returns a new sorted array with `matchGroup` and `relevanceScore` added
 * to each product object.
 */
export function rankProducts(products, query) {
  if (!products.length) return products;

  // Score every product
  const scored = products.map((p) => ({
    ...p,
    ...scoreProduct(p, query), // adds score, matchGroup
  }));

  // Compute price range for the price-factor normalisation
  const prices   = scored.map((p) => p.price).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1; // avoid division by zero

  // Add price factor (0–10): cheaper = higher bonus
  const withPriceFactor = scored.map((p) => ({
    ...p,
    relevanceScore: p.score + (10 * (1 - (p.price - minPrice) / priceRange)),
  }));

  // Sort: highest relevanceScore first; ties broken by price ascending
  return withPriceFactor.sort((a, b) =>
    b.relevanceScore !== a.relevanceScore
      ? b.relevanceScore - a.relevanceScore
      : a.price - b.price
  );
}
