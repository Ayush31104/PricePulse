/**
 * generatePriceHistory(currentPrice, days)
 *
 * Produces realistic-looking price history similar to Buyhatke / Keepa:
 *   - Slow trend phases (gradual rise → plateau → gradual fall)
 *   - Small daily noise (±0.8%) layered on top of the trend
 *   - Occasional sale dips every ~3–5 weeks (festival / flash offers)
 *   - offerPrice line that sits 3–8% below the normal price
 *   - Last point is always anchored to currentPrice
 *   - Stable output for the same currentPrice (seeded via price value)
 *
 * Returns array sorted oldest → newest:
 *   [{ date: "YYYY-MM-DD", price: number, offerPrice: number }, ...]
 */
export function generatePriceHistory(currentPrice, days = 180) {
  // ── Deterministic-ish seed so the chart doesn't re-randomise on every render
  // We derive a seed from currentPrice so the same product always gets the
  // same shape, but different products look different.
  let seed = Math.round(currentPrice) || 1;
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff; // [0, 1)
  }

  const BASE   = currentPrice;
  const FLOOR  = BASE * 0.78;   // never go below 78% of current
  const CEIL   = BASE * 1.22;   // never go above 122% of current

  // ── Build a smooth trend skeleton using a few control points ──────────────
  // Divide the period into 4 segments with random target prices at boundaries.
  // We'll lerp between them to get a slow-moving baseline.
  const segments = 4;
  const targets  = [BASE * (1 + (rand() - 0.5) * 0.18)]; // start offset
  for (let s = 0; s < segments; s++) {
    targets.push(BASE * (1 + (rand() - 0.5) * 0.20));
  }
  targets.push(BASE); // always end at current price

  function trendAt(i) {
    // Which segment does day i fall in?
    const totalPoints = days + 1;
    const segLen      = totalPoints / (targets.length - 1);
    const seg         = Math.min(Math.floor(i / segLen), targets.length - 2);
    const t           = (i - seg * segLen) / segLen; // 0..1 within segment
    // Smooth-step interpolation (ease in/out)
    const smooth = t * t * (3 - 2 * t);
    return targets[seg] + (targets[seg + 1] - targets[seg]) * smooth;
  }

  // ── Decide sale-dip days (every 18–35 days, lasting 2–4 days) ─────────────
  const saleDays = new Set();
  let nextSale   = Math.round(15 + rand() * 20);
  while (nextSale <= days) {
    const dipLen = 2 + Math.round(rand() * 2); // 2–4 days
    for (let d = 0; d < dipLen; d++) saleDays.add(nextSale + d);
    nextSale += Math.round(18 + rand() * 17);
  }

  // ── Generate one point per day ─────────────────────────────────────────────
  const points = [];
  let   noise  = 0; // carry-over noise for smoothness (AR(1) process)

  for (let i = 0; i <= days; i++) {
    const trend = trendAt(i);

    // AR(1) noise: 70% of yesterday's noise + fresh shock
    noise = 0.70 * noise + (rand() - 0.5) * 0.016 * BASE;

    let price = trend + noise;

    // Sale dip: drop 6–14% for a few days
    if (saleDays.has(i)) {
      price *= (0.86 + rand() * 0.08);
    }

    // Clamp
    price = Math.max(FLOOR, Math.min(CEIL, price));
    price = Math.round(price / 10) * 10; // round to nearest ₹10 (looks natural)

    // offerPrice: 3–8% below normal, also rounded
    const offerDiscount = 0.03 + rand() * 0.05;
    const offerPrice    = Math.round(price * (1 - offerDiscount) / 10) * 10;

    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const date = d.toISOString().split('T')[0];

    points.push({ date, price, offerPrice });
  }

  // Anchor last point to actual current price
  points[points.length - 1].price      = currentPrice;
  points[points.length - 1].offerPrice = Math.round(currentPrice * 0.95);

  return points; // already sorted oldest → newest
}
