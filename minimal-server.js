// Minimal server to test Railway deployment
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting minimal server...');
console.log('Environment variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- DB_TYPE:', process.env.DB_TYPE);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Missing ❌');
console.log('- PORT:', PORT);

// Basic health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Minimal server is running',
        timestamp: new Date().toISOString(),
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            DB_TYPE: process.env.DB_TYPE,
            DATABASE_URL_SET: !!process.env.DATABASE_URL,
            PORT: PORT
        }
    });
});

// Test PostgreSQL connection
app.get('/test-db', async (req, res) => {
    try {
        if (!process.env.DATABASE_URL) {
            return res.json({
                status: 'error',
                message: 'DATABASE_URL not set'
            });
        }

        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        client.release();
        await pool.end();

        res.json({
            status: 'success',
            message: 'PostgreSQL connection successful',
            server_time: result.rows[0].current_time,
            version: result.rows[0].version.split(' ')[0]
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// Catch all route
app.get('*', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Minimal server is working',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Minimal server running on port ${PORT}`);
    console.log('📍 Endpoints:');
    console.log('  - GET /health - Health check');
    console.log('  - GET /test-db - PostgreSQL test');
    console.log('  - GET /* - Catch all');
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;
