// ============================================================
// server.js — Entry point of the entire backend application
// ============================================================
// This file does three things in order:
//   1. Loads environment variables from the .env file
//   2. Connects to the MongoDB database
//   3. Starts the Express HTTP server on the configured port
//
// It is intentionally kept small — all Express setup lives in
// app.js so this file only handles startup orchestration.

import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// Only start the HTTP server when running locally (not on Vercel).
// Vercel imports api/index.js directly and handles the HTTP layer itself.
if (process.env.VERCEL !== '1') {
  let server;
  const start = async () => {
    try {
      await connectDB();
      server = app.listen(PORT, () => {
        console.log(`🚀 Backend server ${PORT}`);
        console.log(`📋 Health check: ${PORT}/api/health`);
      });
    } catch (error) {
      console.error('❌ Server failed to start:', error.message);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    server?.close(() => console.log('Process terminated'));
  });

  start();
}
