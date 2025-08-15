const database = require('./config/database');

async function checkSignatureColumns() {
    try {
        console.log('🔗 Checking database connection...');

        // Check which signature columns exist
        const result = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts' 
            AND COLUMN_NAME LIKE '%Signature%'
            ORDER BY COLUMN_NAME
        `);
        
        console.log('📋 Current signature-related columns in Contracts table:');
        if (result.recordset.length === 0) {
            console.log('❌ No signature columns found!');
        } else {
            console.table(result.recordset);
        }
        
        // Also check for IP address column
        const ipResult = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts' 
            AND COLUMN_NAME LIKE '%IP%'
        `);
        
        console.log('\n📋 IP Address related columns:');
        if (ipResult.recordset.length === 0) {
            console.log('❌ No IP address columns found!');
        } else {
            console.table(ipResult.recordset);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error checking columns:', error);
        process.exit(1);
    }
}

checkSignatureColumns();
