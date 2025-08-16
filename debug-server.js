// Debug server - shows environment variables and connection status
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Simple health check with debug info
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            DB_TYPE: process.env.DB_TYPE,
            DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
            PORT: process.env.PORT,
            RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT
        }
    });
});

// Debug database connection
app.get('/debug-db', async (req, res) => {
    try {
        if (process.env.DB_TYPE === 'postgresql' && process.env.DATABASE_URL) {
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
                status: 'PostgreSQL connection successful',
                server_time: result.rows[0].current_time,
                database_type: 'PostgreSQL'
            });
        } else {
            res.json({
                status: 'No PostgreSQL configuration found',
                DB_TYPE: process.env.DB_TYPE,
                DATABASE_URL_SET: !!process.env.DATABASE_URL
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'Database connection failed',
            error: error.message
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔍 Debug server running on port ${PORT}`);
    console.log('Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- DB_TYPE:', process.env.DB_TYPE);
    console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Missing ❌');
    console.log('- PORT:', process.env.PORT);
    console.log('- RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
    console.log('\nEndpoints:');
    console.log('- GET /health - Basic health check');
    console.log('- GET /debug-db - Database connection test');
});
