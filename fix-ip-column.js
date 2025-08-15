const database = require('./config/database');

async function addIPAddressColumn() {
    try {
        await database.connect();
        console.log('🔗 Connected to database');

        // Add the missing SignatureIPAddress column
        try {
            await database.query(`
                ALTER TABLE Contracts 
                ADD SignatureIPAddress NVARCHAR(45)
            `);
            console.log('✅ Added SignatureIPAddress column successfully!');
        } catch (error) {
            if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
                console.log('⏭️ SignatureIPAddress column already exists');
            } else {
                throw error;
            }
        }
        
        // Verify all signature columns exist
        const result = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts' 
            AND (COLUMN_NAME LIKE '%Signature%' OR COLUMN_NAME LIKE '%IP%')
            ORDER BY COLUMN_NAME
        `);
        
        console.log('📋 Signature and IP columns in Contracts table:');
        console.table(result.recordset);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addIPAddressColumn();
