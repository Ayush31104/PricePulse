// routes/productRoutes.js
import express from 'express';
import {
  searchProducts,
  getProductById,
  getTrending,
  compareLinkProducts,
} from '../controllers/productController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { validateSearch, validateCompareLink } from '../middleware/validateMiddleware.js';
import { searchLimiter } from '../config/rateLimiter.js';

const router = express.Router();

// GET /api/products/trending — must be before /:id to avoid route conflict
router.get('/trending', getTrending);

// GET /api/products/search?q=...
router.get('/search', searchLimiter, optionalAuth, validateSearch, searchProducts);

// POST /api/products/compare-link  — paste a URL, get cross-platform comparison
router.post('/compare-link', searchLimiter, optionalAuth, validateCompareLink, compareLinkProducts);

// Explicitly guard /:id so it never matches named sub-paths like /price-history
// GET /api/products/:id — only matches valid MongoDB ObjectIds (24 hex chars)
router.get('/:id([a-fA-F0-9]{24})', getProductById);

export default router;
