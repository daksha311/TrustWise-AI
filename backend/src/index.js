require('dotenv').config();
const express = require('express');
const cors = require('cors');
const verifyRoutes = require('./routes/verify');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', verifyRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'TrustWise AI Backend',
    version: '1.0.0',
    status: 'running',
    services: {
      tlsnotary: 'active',
      codex: 'active'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 TrustWise Backend running on http://localhost:${PORT}`);
  logger.info(`📡 API endpoints ready: /api/zkproof, /api/dispute/resolve`);
});