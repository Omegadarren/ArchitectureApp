const { Pool } = require('pg');
require('dotenv').config();

async function testPostgreSQLConnection() {
    console.log('🔍 Testing PostgreSQL connection...\n');
    
    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL environment variable not set');
        console.log('💡 Get this from your Railway PostgreSQL service Variables tab');
        return;
    }
    
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        console.log('🔗 Attempting connection...');
        
        // Test basic connection
        const client = await pool.connect();
        console.log('✅ Successfully connected to PostgreSQL!');
        
        // Test basic query
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        console.log('✅ Database query successful');
        console.log(`📅 Current time: ${result.rows[0].current_time}`);
        console.log(`🐘 PostgreSQL version: ${result.rows[0].version.split(' ')[0]}`);
        
        // Check if our tables exist
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        console.log('\n📋 Existing tables:');
        if (tableCheck.rows.length === 0) {
            console.log('   (No tables found - this is normal for a new database)');
        } else {
            tableCheck.rows.forEach(row => {
                console.log(`   - ${row.table_name}`);
            });
        }
        
        client.release();
        await pool.end();
        
        console.log('\n🎉 PostgreSQL connection test completed successfully!');
        console.log('✅ Ready for migration or application deployment');
        
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
        console.log('\n💡 Troubleshooting tips:');
        console.log('   1. Check your DATABASE_URL is correct');
        console.log('   2. Ensure PostgreSQL service is running on Railway');
        console.log('   3. Verify network connectivity');
        console.log('   4. Check if SSL configuration is correct');
        
        console.log('\n🔗 Your DATABASE_URL should look like:');
        console.log('   postgresql://username:password@host:port/database');
    }
}

// Run the test
testPostgreSQLConnection();
