const { connectToDatabase } = require('./config/database');

async function testSignatures() {
    try {
        const database = await connectToDatabase();
        console.log('🔗 Connected to database');

        // Check if signature columns exist
        console.log('📋 Checking signature columns...');
        const columns = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts' 
            AND COLUMN_NAME IN ('ContractorSignature', 'ClientSignature', 'ContractorSignatureDate', 'ClientSignatureDate', 'SignatureIPAddress')
            ORDER BY COLUMN_NAME
        `);
        
        console.log('✅ Signature columns found:');
        console.table(columns.recordset);
        
        // Check existing contracts
        console.log('\n📋 Checking existing contracts...');
        const contracts = await database.query('SELECT ContractID, ContractNumber, ContractStatus FROM Contracts');
        console.log(`Found ${contracts.recordset.length} contracts:`);
        console.table(contracts.recordset);
        
        // If we have contracts, test getting one
        if (contracts.recordset.length > 0) {
            const contractId = contracts.recordset[0].ContractID;
            console.log(`\n📄 Testing contract details for Contract ID: ${contractId}`);
            
            const contractDetails = await database.query(`
                SELECT c.*, p.ProjectName, cust.CompanyName 
                FROM Contracts c
                INNER JOIN Projects p ON c.ProjectID = p.ProjectID
                INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
                WHERE c.ContractID = @contractId
            `, { contractId });
            
            console.log('Contract details:');
            console.table(contractDetails.recordset);
        } else {
            console.log('⚠️ No contracts found. You may need to create one first.');
        }
        
    } catch (error) {
        console.error('❌ Error testing signatures:', error);
    }
}

// Run the test
testSignatures()
    .then(() => {
        console.log('🎉 Signature test complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Test failed:', error);
        process.exit(1);
    });
