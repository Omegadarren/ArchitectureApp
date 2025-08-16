// Ultra-stable Railway server - designed to stay up
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting ultra-stable Railway server...');
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Database: ${process.env.DB_TYPE || 'None'}`);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health checks - multiple endpoints
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        uptime: Math.floor(process.uptime())
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Architecture App - Railway Stable Version',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: ['/health', '/api/health', '/test-db']
    });
});

// Test database connection (non-blocking)
app.get('/test-db', async (req, res) => {
    if (!process.env.DATABASE_URL) {
        return res.json({
            status: 'info',
            message: 'No DATABASE_URL configured',
            database: 'Not connected'
        });
    }

    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time');
        client.release();
        await pool.end();

        res.json({
            status: 'success',
            message: 'PostgreSQL connected',
            server_time: result.rows[0].current_time
        });
    } catch (error) {
        res.json({
            status: 'error',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// Catch-all
app.get('*', (req, res) => {
    res.json({
        message: 'Architecture App API',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Error handling - prevent crashes
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception (handled):', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection (handled):', reason);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Ultra-stable server running on port ${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/health`);
    console.log(`🔍 Test DB: http://localhost:${PORT}/test-db`);
    console.log('🛡️ Error handling active - server will not crash');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
