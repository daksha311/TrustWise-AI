require('dotenv').config();
const express = require('express');
const cors = require('cors');
const verifyRoutes = require('./routes/verify');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Updated CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', verifyRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'TrustWise AI Backend',
    version: '2.0.0',
    status: 'running',
    services: {
      tlsnotary: 'active',
      codex: 'active',
      blockchain: 'connected'
    },
    contract: process.env.CONTRACT_ADDRESS || 'not configured'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      tlsnotary: 'ready',
      codex: 'ready',
      contract: process.env.CONTRACT_ADDRESS ? 'configured' : 'missing'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  logger.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 TrustWise Backend running on http://localhost:${PORT}`);
  logger.info(`📡 Contract: ${process.env.CONTRACT_ADDRESS || 'not set'}`);
  logger.info(`📡 API endpoints: /api/verify/zkproof, /api/dispute/resolve`);
});