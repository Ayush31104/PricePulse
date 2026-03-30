// ============================================================
// controllers/historyController.js — Search history management
// ============================================================
// Handles reading and clearing a user's personal search history.
// Both routes require authentication (the `auth` middleware in
// historyRoutes.js ensures req.user is always populated here).

import SearchHistory from '../models/SearchHistory.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { badRequest } from '../utils/ApiError.js';

/**
 * POST /api/history
 * Saves a search query for the logged-in user.
 * Called automatically by the frontend after every search.
 *
 * Request body: { query, resultsCount, cheapestPrice, cheapestPlatform }
 */
export const saveSearch = async (req, res, next) => {
  try {
    const { query, resultsCount, cheapestPrice, cheapestPlatform } = req.body;
    if (!query) return next(badRequest('query is required'));

    const entry = await SearchHistory.create({
      userId: req.user._id,
      query,
      resultsCount:    resultsCount    ?? 0,
      cheapestPrice:   cheapestPrice   ?? null,
      cheapestPlatform: cheapestPlatform ?? null,
    });

    return sendSuccess(res, entry, 'Search saved', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/history
 * Returns the authenticated user's search history, newest first.
 * Supports pagination via ?page=1&limit=20
 *
 * Response: array of search history records + pagination meta
 */
export const getHistory = async (req, res, next) => {
  try {
    // Parse pagination params, with sensible defaults and safety caps
    const page  = Math.max(1, parseInt(req.query.page  || 1,  10));
    const limit = Math.min(50, parseInt(req.query.limit || 20, 10)); // max 50 per page

    // Run both queries in parallel for efficiency:
    //   1. Fetch the paginated history records
    //   2. Count the total number of records (needed for totalPages)
    const [history, total] = await Promise.all([
      SearchHistory.find({ userId: req.user._id })
        .sort({ createdAt: -1 })          // newest first
        .skip((page - 1) * limit)         // skip records from previous pages
        .limit(limit)                     // only return this page's records
        .lean(),                          // plain JS objects (faster than Mongoose docs)
      SearchHistory.countDocuments({ userId: req.user._id }),
    ]);

    return sendSuccess(res, history, 'Search history', 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/history
 * Permanently deletes all search history records for the logged-in user.
 *
 * Response: success message with no data payload
 */
export const clearHistory = async (req, res, next) => {
  try {
    // deleteMany removes all documents matching the filter
    await SearchHistory.deleteMany({ userId: req.user._id });
    return sendSuccess(res, null, 'Search history cleared');
  } catch (err) {
    next(err);
  }
};
