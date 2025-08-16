// Railway Debug Server - Log everything
console.log('=== RAILWAY DEBUG SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PWD:', process.env.PWD);

const express = require('express');
console.log('Express loaded successfully');

const app = express();
console.log('Express app created');

const PORT = process.env.PORT || 3000;
console.log('Port determined:', PORT);

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'ok', 
    message: 'Railway debug server',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: process.uptime()
  });
});

// Catch-all endpoint
app.use('*', (req, res) => {
  console.log('Catch-all handler triggered for:', req.originalUrl);
  res.json({ 
    status: 'ok', 
    message: 'Railway debug server catch-all',
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

console.log('About to start server on port:', PORT);

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=== SERVER STARTED SUCCESSFULLY ===');
  console.log(`Railway debug server running on port ${PORT}`);
  console.log('Server address:', server.address());
  console.log('Process ID:', process.pid);
  console.log('=== READY FOR CONNECTIONS ===');
});

server.on('error', (err) => {
  console.error('=== SERVER ERROR ===');
  console.error('Error starting server:', err);
  process.exit(1);
});

// Handle process signals
process.on('SIGTERM', () => {
  console.log('=== SIGTERM RECEIVED ===');
  server.close(() => {
    console.log('Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('=== SIGINT RECEIVED ===');
  server.close(() => {
    console.log('Server closed gracefully');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('At:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('=== DEBUG SERVER SETUP COMPLETE ===');
