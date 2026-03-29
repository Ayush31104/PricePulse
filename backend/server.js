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

import 'dotenv/config';        // Reads .env and injects values into process.env
import app from './app.js';           // The fully configured Express application
import connectDB from './config/db.js'; // Helper that opens the MongoDB connection

// Read PORT from environment, fall back to 5000 for local development
const PORT = process.env.PORT || 5000;

// async start() lets us await the DB connection before opening the HTTP port.
// If we started the server before the DB was ready, requests would fail.
let server;

const start = async () => {
  try {
    // Step 1 — Connect to MongoDB. Throws if the connection fails.
    await connectDB();

    // Step 2 — Begin accepting HTTP requests only after DB is ready
    server = app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    // Something went wrong during startup — log it and crash intentionally
    // so a process manager (e.g. PM2) can restart the app cleanly
    console.error('❌ Server failed to start:', error.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

start();
