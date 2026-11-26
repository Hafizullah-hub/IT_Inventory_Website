// backend/src/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const assetRoutes = require('./routes/assetRoutes');

const app = express();

const allowedOrigins = new Set(
  [process.env.FRONTEND_URL?.replace(/\/$/, ''), 'http://localhost:3000'].filter(Boolean)
);

function isAllowedOrigin(origin) {
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || isAllowedOrigin(origin));
    },
  })
);
app.use(express.json());

// Database Connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/it_inventory')
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/assets', assetRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
