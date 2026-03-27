// middleware/validateMiddleware.js
// Lightweight input validation without a heavy library.
// Each validator is an Express middleware that calls next() or returns 400.

import { badRequest } from '../utils/ApiError.js';

// Validates GET /api/products/search?q=...
export const validateSearch = (req, res, next) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return next(badRequest('Query parameter "q" is required'));
  }
  if (q.trim().length < 2) {
    return next(badRequest('Search query must be at least 2 characters'));
  }
  // Sanitize: strip leading/trailing whitespace and normalise to lowercase
  req.query.q = q.trim();
  next();
};

// Validates POST /api/auth/register
export const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2)          errors.push('Name must be at least 2 characters');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required');
  if (!password || password.length < 6)          errors.push('Password must be at least 6 characters');

  if (errors.length) return next(badRequest(errors.join('. ')));
  next();
};

// Validates POST /api/auth/login
export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(badRequest('Email and password are required'));
  }
  next();
};

// Validates POST /api/products/compare-link
export const validateCompareLink = (req, res, next) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return next(badRequest('A product URL is required'));
  }

  // Basic URL format check before we do anything else
  try {
    new URL(url.trim());
  } catch {
    return next(badRequest('Please provide a valid URL (must start with http:// or https://)'));
  }

  req.body.url = url.trim();
  next();
};
