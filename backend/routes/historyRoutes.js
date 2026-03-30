// routes/historyRoutes.js
import express from 'express';
import { getHistory, clearHistory, saveSearch } from '../controllers/historyController.js';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/',   auth, saveSearch);   // POST   /api/history — save a search
router.get('/',    auth, getHistory);   // GET    /api/history — get user history
router.delete('/', auth, clearHistory); // DELETE /api/history — clear history

export default router;