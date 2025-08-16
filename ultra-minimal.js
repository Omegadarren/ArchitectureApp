// Ultra minimal test server
const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('🟢 Starting ultra minimal server...');
console.log('Environment check:');
Object.keys(process.env).forEach(key => {
    if (key.includes('DATABASE') || key.includes('DB_') || key === 'NODE_ENV' || key === 'PORT') {
        console.log(`${key}: ${process.env[key] || 'not set'}`);
    }
});

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'ok',
        message: 'Ultra minimal server works!',
        timestamp: new Date().toISOString(),
        path: req.url,
        env_check: {
            NODE_ENV: process.env.NODE_ENV,
            DB_TYPE: process.env.DB_TYPE,
            DATABASE_URL_SET: !!process.env.DATABASE_URL,
            PORT: PORT
        }
    }, null, 2));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Ultra minimal server running on port ${PORT}`);
    console.log(`🌐 Ready to accept requests`);
});

server.on('error', (error) => {
    console.error('💥 Server error:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    process.exit(1);
});
