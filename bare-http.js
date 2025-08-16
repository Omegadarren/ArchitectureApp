const http = require('http');

const PORT = process.env.PORT || 3000;

console.log('=== RAILWAY DEPLOYMENT - BARE HTTP SERVER ===');
console.log('Starting bare HTTP server...');
console.log('PORT:', PORT);
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Railway URL expected: https://architectureapp-production.up.railway.app');

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  
  // Set proper headers for Railway load balancer
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    'X-Powered-By': 'Railway-Node-Bare-HTTP'
  });
  
  const response = {
    status: 'ok',
    message: 'Railway Bare HTTP Server - WORKING!',
    timestamp: timestamp,
    port: PORT,
    url: req.url,
    method: req.method,
    uptime: Math.round(process.uptime()),
    pid: process.pid,
    userAgent: req.headers['user-agent'] || 'unknown',
    railway: true
  };
  
  // Enhanced logging for debugging
  console.log(`${timestamp} - RESPONDING with status 200`);
  console.log(`${timestamp} - Response: ${JSON.stringify(response, null, 0)}`);
  
  res.end(JSON.stringify(response, null, 2));
});

// Listen on all interfaces (0.0.0.0) for Railway
server.listen(PORT, '0.0.0.0', () => {
  console.log('=== BARE HTTP SERVER STARTED SUCCESSFULLY ===');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Listening on all interfaces (0.0.0.0:${PORT})`);
  console.log(`✅ PID: ${process.pid}`);
  console.log(`✅ Memory usage: ${JSON.stringify(process.memoryUsage())}`);
  console.log('=== READY FOR RAILWAY TRAFFIC ===');
  
  // Log every 30 seconds to prove server is alive
  setInterval(() => {
    console.log(`${new Date().toISOString()} - HEARTBEAT: Server alive, uptime: ${Math.round(process.uptime())}s`);
  }, 30000);
});

server.on('error', (err) => {
  console.error('=== SERVER ERROR ===');
  console.error('Error starting server:', err);
  console.error('Port:', PORT);
  console.error('Time:', new Date().toISOString());
  process.exit(1);
});

server.on('connection', (socket) => {
  console.log(`${new Date().toISOString()} - NEW CONNECTION from ${socket.remoteAddress}:${socket.remotePort}`);
});

// Enhanced process signal handling
process.on('SIGTERM', () => {
  console.log('=== SIGTERM RECEIVED - GRACEFUL SHUTDOWN ===');
  server.close(() => {
    console.log('Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('=== SIGINT RECEIVED - GRACEFUL SHUTDOWN ===');
  server.close(() => {
    console.log('Server closed gracefully');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('Time:', new Date().toISOString());
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('At:', promise);
  console.error('Reason:', reason);
  console.error('Time:', new Date().toISOString());
  process.exit(1);
});

console.log('=== BARE HTTP SERVER SETUP COMPLETE ===');
console.log('Waiting for Railway to route traffic...');
