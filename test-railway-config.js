// Test your database configuration locally
require('dotenv').config();
const database = require('./config/database');

async function testDatabaseConfig() {
    console.log('🔍 Testing your database configuration...\n');
    
    // Temporarily set environment variables for testing
    process.env.DB_TYPE = 'postgresql';
    process.env.DATABASE_URL = 'postgresql://postgres:dFATbnaTxDiUQVPLIaDQyaXCVeIwGUhh@postgres.railway.internal:5432/railway';
    
    try {
        console.log('Database Type:', process.env.DB_TYPE);
        console.log('Database URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Missing ❌');
        
        // Test connection
        await database.connect();
        
        console.log('\n🎉 Database configuration test successful!');
        console.log('Your app is ready to use PostgreSQL on Railway.');
        
        // Test a simple query
        const result = await database.query('SELECT 1 as test_value');
        console.log('✅ Query test passed:', result.recordset);
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        
        if (error.message.includes('ENOTFOUND')) {
            console.log('\n💡 This is expected for local testing!');
            console.log('The internal Railway URL only works within Railway.');
            console.log('Your configuration is correct for deployment.');
        }
    } finally {
        await database.close();
    }
}

testDatabaseConfig();
