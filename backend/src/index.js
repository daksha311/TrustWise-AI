require('dotenv').config();
const express = require('express');
const cors = require('cors');
const verifyRoutes = require('./routes/verify');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Routes
app.use('/api', verifyRoutes);

// Root
app.get('/', (req, res) => {
  const { success } = require('./utils/response');
  return success(res, { name: 'TrustWise AI Backend', version: '3.0.0', status: 'running' });
});

// Error handler
// Centralized error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🚀 TrustWise Backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
