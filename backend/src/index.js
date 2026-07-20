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

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'TrustWise AI Backend',
    version: '3.0.0',
    status: 'running'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

app.listen(PORT, () => {
  logger.info(`🚀 TrustWise Backend running on http://localhost:${PORT}`);
});
