// controllers/priceHistoryController.js

import PriceHistory from '../models/PriceHistory.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { badRequest } from '../utils/ApiError.js';

/**
 * GET /api/products/price-history?productId=<id>&days=<n>
 * Returns snapshots filtered to the requested window.
 * days=0 or omitted → return all snapshots (Max / all-time).
 * Response: { data: [{ date, price }], stats: { min, max, avg, current } }
 */
export const getPriceHistory = async (req, res, next) => {
  try {
    const { productId, days } = req.query;
    if (!productId) return next(badRequest('productId query param is required'));

    const record = await PriceHistory.findOne({ productId }).lean();

    if (!record || !record.snapshots.length) {
      return sendSuccess(res, { data: [], stats: null }, 'No price history available');
    }

    // Filter snapshots to the requested time window
    const numDays = parseInt(days, 10);
    const cutoff  = numDays > 0
      ? new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
      : new Date(0); // epoch = all-time

    const filtered = record.snapshots.filter((s) => new Date(s.recordedAt) >= cutoff);
    const source   = filtered.length >= 2 ? filtered : record.snapshots;

    const data = source.map((s) => ({
      date:  new Date(s.recordedAt).toISOString().split('T')[0],
      price: s.price,
    }));

    const prices  = source.map((s) => s.price);
    const min     = Math.min(...prices);
    const max     = Math.max(...prices);
    const avg     = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const current = prices[prices.length - 1];

    return sendSuccess(res, { data, stats: { min, max, avg, current } }, 'Price history');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products/price-history
 * Body: { productId, title, price }
 *
 * First visit  → seeds 90 days of realistic historical data + today's real price.
 * Return visit → appends a new snapshot if price changed or it's a new day.
 */
export const recordPriceSnapshot = async (req, res, next) => {
  try {
    const { productId, title, price } = req.body;
    if (!productId || !title || price == null) {
      return next(badRequest('productId, title, and price are required'));
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return next(badRequest('price must be a positive number'));
    }

    const now    = new Date();
    const record = await PriceHistory.findOne({ productId });

    if (!record) {
      // ── First time this product is seen — seed 365 days of history ─────────
      const snapshots = generateSeedHistory(numPrice, 365);
      snapshots.push({ price: numPrice, recordedAt: now });

      await PriceHistory.create({ productId, title, snapshots });
      return sendSuccess(res, null, 'Snapshot recorded with seeded history');
    }

    // ── Existing record — append only if price changed or it's a new day ────
    const last         = record.snapshots[record.snapshots.length - 1];
    const lastDate     = new Date(last.recordedAt).toISOString().split('T')[0];
    const todayDate    = now.toISOString().split('T')[0];
    const priceChanged = last.price !== numPrice;
    const isNewDay     = lastDate !== todayDate;

    if (priceChanged || isNewDay) {
      record.snapshots.push({ price: numPrice, recordedAt: now });
      await record.save();
    }

    return sendSuccess(res, null, 'Snapshot recorded');
  } catch (err) {
    next(err);
  }
};

/**
 * generateSeedHistory(currentPrice, days)
 *
 * Generates realistic-looking price history for the past `days` days.
 * Uses a random walk with mean-reversion so prices stay in a believable
 * range around the current price (±20%).
 *
 * Returns an array of { price, recordedAt } snapshots, one per day,
 * sorted oldest → newest, NOT including today (caller adds today's real price).
 */
function generateSeedHistory(currentPrice, days) {
  const snapshots     = [];
  const volatility    = 0.012;
  const meanReversion = 0.08;
  const seedDays      = days - 1;

  let price = currentPrice;
  const rawPrices = [price];

  for (let i = 0; i < seedDays; i++) {
    const drift  = meanReversion * (currentPrice - price) / currentPrice;
    const shock  = (Math.random() - 0.5) * 2 * volatility;
    price = Math.round(price * (1 - (drift + shock)));
    price = Math.max(
      Math.round(currentPrice * 0.75),
      Math.min(Math.round(currentPrice * 1.25), price)
    );
    rawPrices.push(price);
  }

  rawPrices.reverse();

  for (let i = 0; i < rawPrices.length; i++) {
    const d = new Date(Date.now() - (seedDays - i) * 24 * 60 * 60 * 1000);
    d.setUTCHours(0, 0, 0, 0);
    snapshots.push({ price: rawPrices[i], recordedAt: d });
  }

  return snapshots;
}
