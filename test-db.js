const database = require('./config/database');
require('dotenv').config();

async function testDatabase() {
    try {
        console.log('Connecting to database...');
        await database.connect();
        console.log('Connected successfully!');
        
        console.log('Testing simple query...');
        const result = await database.query('SELECT COUNT(*) as count FROM Customers');
        console.log('Customer count:', result.recordset[0].count);
        
        console.log('Testing customers query...');
        const customers = await database.query('SELECT TOP 3 CustomerID, CompanyName FROM Customers');
        console.log('Customers:', customers.recordset);
        
        console.log('All tests passed!');
    } catch (error) {
        console.error('Database test failed:', error);
    } finally {
        await database.close();
        process.exit(0);
    }
}

testDatabase();
