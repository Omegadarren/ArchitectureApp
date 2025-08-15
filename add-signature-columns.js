const database = require('./config/database');

async function addSignatureColumns() {
    try {
        await database.connect();
        console.log('🔗 Connected to database');

        console.log('📋 Adding signature columns to Contracts table...');
        
        // Check if columns already exist to avoid errors
        const checkColumns = await database.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts' 
            AND COLUMN_NAME IN ('ContractorSignature', 'ClientSignature', 'ContractorSignatureDate', 'ClientSignatureDate', 'SignatureIPAddress')
        `);
        
        const existingColumns = checkColumns.recordset.map(row => row.COLUMN_NAME);
        console.log('📋 Existing signature columns:', existingColumns);
        
        const columnsToAdd = [
            { name: 'ContractorSignature', type: 'NVARCHAR(255)' },
            { name: 'ClientSignature', type: 'NVARCHAR(255)' },
            { name: 'ContractorSignatureDate', type: 'DATE' },
            { name: 'ClientSignatureDate', type: 'DATE' },
            { name: 'SignatureIPAddress', type: 'NVARCHAR(45)' }
        ];
        
        for (const column of columnsToAdd) {
            if (!existingColumns.includes(column.name)) {
                console.log(`➕ Adding column ${column.name}...`);
                await database.query(`
                    ALTER TABLE Contracts 
                    ADD ${column.name} ${column.type}
                `);
            } else {
                console.log(`⏭️ Column ${column.name} already exists, skipping...`);
            }
        }
        
        console.log('✅ Signature columns added successfully!');
        
        // Display the updated table structure
        const tableStructure = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('\n📋 Updated Contracts table structure:');
        console.table(tableStructure.recordset);
        
    } catch (error) {
        console.error('❌ Error adding signature columns:', error);
        throw error;
    }
}

// Run the script
addSignatureColumns()
    .then(() => {
        console.log('🎉 Signature columns setup complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    });
