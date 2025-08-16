const http = require('http');

const PORT = process.env.PORT || 3000;

console.log('Starting bare HTTP server...');
console.log('PORT:', PORT);
console.log('Node version:', process.version);

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  const response = {
    status: 'ok',
    message: 'Bare HTTP server running on Railway',
    timestamp: new Date().toISOString(),
    port: PORT,
    url: req.url,
    method: req.method
  };
  
  res.end(JSON.stringify(response, null, 2));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=== BARE HTTP SERVER STARTED ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`=== READY ===`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
