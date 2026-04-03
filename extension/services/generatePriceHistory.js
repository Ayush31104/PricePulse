// extension/services/generatePriceHistory.js
// Produces smooth, realistic 180-day price history — no random spikes.
// Loaded before popup.js via popup.html <script> tag.
//
// Algorithm:
//   - Smooth trend skeleton: 4 control points interpolated with smooth-step
//   - AR(1) noise: correlated day-to-day movement (not independent random)
//   - Sale dips: every 18–35 days, 2–4 day window drops 6–14% (flash offers)
//   - offerPrice: 3–8% below normal each day
//   - Prices rounded to nearest ₹10, clamped to ±22% of base
//   - Deterministic per product (seeded from currentPrice) — same product
//     always gets the same shape, different products look different

function generatePriceHistory(currentPrice, days) {
  days = days || 180;

  // ── Deterministic seed derived from currentPrice ──────────────────────────
  let seed = Math.round(currentPrice) || 1;
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff; // [0, 1)
  }

  const BASE  = currentPrice;
  const FLOOR = BASE * 0.78;
  const CEIL  = BASE * 1.22;

  // ── Smooth trend skeleton via control points + smooth-step lerp ───────────
  const targets = [BASE * (1 + (rand() - 0.5) * 0.18)];
  for (let s = 0; s < 4; s++) targets.push(BASE * (1 + (rand() - 0.5) * 0.20));
  targets.push(BASE); // always end at current price

  function trendAt(i) {
    const totalPoints = days + 1;
    const segLen      = totalPoints / (targets.length - 1);
    const seg         = Math.min(Math.floor(i / segLen), targets.length - 2);
    const t           = (i - seg * segLen) / segLen;
    const smooth      = t * t * (3 - 2 * t); // smooth-step
    return targets[seg] + (targets[seg + 1] - targets[seg]) * smooth;
  }

  // ── Sale dip days ─────────────────────────────────────────────────────────
  const saleDays = new Set();
  let nextSale   = Math.round(15 + rand() * 20);
  while (nextSale <= days) {
    const dipLen = 2 + Math.round(rand() * 2);
    for (let d = 0; d < dipLen; d++) saleDays.add(nextSale + d);
    nextSale += Math.round(18 + rand() * 17);
  }

  // ── Generate one point per day ────────────────────────────────────────────
  const points = [];
  let   noise  = 0;

  for (let i = 0; i <= days; i++) {
    const trend = trendAt(i);

    // AR(1): 70% carry-over + fresh shock
    noise = 0.70 * noise + (rand() - 0.5) * 0.016 * BASE;

    let price = trend + noise;
    if (saleDays.has(i)) price *= (0.86 + rand() * 0.08);

    price = Math.max(FLOOR, Math.min(CEIL, price));
    price = Math.round(price / 10) * 10;

    const offerDiscount = 0.03 + rand() * 0.05;
    const offerPrice    = Math.round(price * (1 - offerDiscount) / 10) * 10;

    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const date = d.toISOString().split('T')[0];

    points.push({ date, normal: price, offer: offerPrice });
  }

  // Anchor last point to actual live price
  points[points.length - 1].normal = currentPrice;
  points[points.length - 1].offer  = Math.round(currentPrice * 0.95 / 10) * 10;

  return points; // [{ date, normal, offer }, ...] oldest → newest
}

window.generatePriceHistory = generatePriceHistory;
