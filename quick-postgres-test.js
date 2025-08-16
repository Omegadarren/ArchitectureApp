// Quick test script - you'll run this locally with your Railway DATABASE_URL
const { Pool } = require('pg');

async function quickTest() {
    const DATABASE_URL = process.argv[2];
    
    if (!DATABASE_URL) {
        console.log('❌ Please provide DATABASE_URL as argument');
        console.log('Usage: node quick-postgres-test.js "postgresql://..."');
        return;
    }
    
    console.log('🔍 Testing Railway PostgreSQL connection...\n');
    
    try {
        const pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        
        console.log('✅ Connection successful!');
        console.log(`📅 Server time: ${result.rows[0].current_time}`);
        console.log(`🐘 PostgreSQL version: ${result.rows[0].version.split(' ')[0]}`);
        
        client.release();
        await pool.end();
        
        console.log('\n🎉 Railway PostgreSQL is ready!');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

quickTest();
