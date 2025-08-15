const database = require('./config/database');

async function checkSignatureSchema() {
    try {
        await database.connect();
        
        console.log('🔍 Checking signature-related columns in Contracts table...');
        
        // Check which signature columns exist
        const result = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts' 
            AND COLUMN_NAME IN (
                'ContractorSignature', 'ClientSignature', 
                'ContractorSignatureDate', 'ClientSignatureDate', 
                'SignatureIPAddress', 'SignedDate', 'ContractStatus'
            )
            ORDER BY COLUMN_NAME
        `);
        
        console.log('\n📋 Found columns:');
        result.recordset.forEach(col => {
            console.log(`✅ ${col.COLUMN_NAME} (${col.DATA_TYPE}) - Nullable: ${col.IS_NULLABLE}`);
        });
        
        const foundColumns = result.recordset.map(col => col.COLUMN_NAME);
        const requiredColumns = [
            'ContractorSignature', 'ClientSignature',
            'ContractorSignatureDate', 'ClientSignatureDate',
            'SignatureIPAddress', 'SignedDate', 'ContractStatus'
        ];
        
        console.log('\n🔍 Missing columns:');
        const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
        if (missingColumns.length === 0) {
            console.log('✅ All required signature columns exist!');
        } else {
            console.log('❌ Missing columns:', missingColumns);
        }
        
        // Test a simple contract query
        console.log('\n🧪 Testing contract query...');
        const contractTest = await database.query(`
            SELECT TOP 1 ContractID, ContractNumber, ContractStatus, SignedDate
            FROM Contracts
        `);
        
        if (contractTest.recordset.length > 0) {
            console.log('✅ Contract query successful');
            console.log('Sample contract:', contractTest.recordset[0]);
        } else {
            console.log('⚠️ No contracts found in database');
        }
        
        await database.close();
        
    } catch (error) {
        console.error('❌ Error checking signature schema:', error);
        console.error('Error details:', error.message);
    }
}

checkSignatureSchema().then(() => {
    console.log('\n🎉 Signature schema check complete!');
}).catch(error => {
    console.error('💥 Schema check failed:', error);
});
