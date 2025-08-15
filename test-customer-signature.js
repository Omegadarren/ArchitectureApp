const database = require('./config/database');

async function testCustomerSignature() {
    try {
        await database.connect();
        
        // First, let's find or create a test contract
        console.log('🔍 Looking for test contract...');
        let contractResult = await database.query(`
            SELECT TOP 1 c.ContractID, c.ContractNumber, c.ContractStatus,
                   p.ProjectName, cust.CompanyName
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            WHERE c.ContractStatus = 'Draft'
            ORDER BY c.ContractID DESC
        `);
        
        if (contractResult.recordset.length === 0) {
            console.log('❌ No draft contracts found to test with');
            return;
        }
        
        const contract = contractResult.recordset[0];
        console.log(`✅ Found test contract: ${contract.ContractNumber} - ${contract.ProjectName}`);
        console.log(`   Customer: ${contract.CompanyName}`);
        console.log(`   Current Status: ${contract.ContractStatus}`);
        
        // Simulate signing from a customer's phone/device
        const testSignatureData = {
            clientSignature: 'John Customer',
            clientDate: '2025-08-13',
            signedTimestamp: new Date().toISOString(),
            ipAddress: '192.168.1.100' // Simulate customer's home IP
        };
        
        console.log('\n📝 Testing customer signature API...');
        console.log('Signature data:', testSignatureData);
        
        // Test the customer signature endpoint via HTTP
        const fetch = require('node-fetch');
        const response = await fetch(`http://localhost:3000/api/contracts/${contract.ContractID}/customer-signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testSignatureData)
        });
        
        console.log(`\n📡 API Response Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ API Error Response:', errorText);
            return;
        }
        
        const result = await response.json();
        console.log('✅ API Success Response:', result);
        
        // Verify the contract was updated in database
        const updatedContract = await database.query(`
            SELECT ContractID, ContractNumber, ContractStatus, SignedDate,
                   ClientSignature, ClientSignatureDate, SignatureIPAddress
            FROM Contracts
            WHERE ContractID = @contractId
        `, { contractId: contract.ContractID });
        
        console.log('\n📋 Updated contract in database:');
        console.log(updatedContract.recordset[0]);
        
        await database.close();
        
    } catch (error) {
        console.error('❌ Error testing customer signature:', error);
        console.error('Error details:', error.message);
    }
}

// Check if node-fetch is available, install if needed
async function ensureNodeFetch() {
    try {
        require('node-fetch');
        return true;
    } catch (error) {
        console.log('📦 Installing node-fetch for API testing...');
        const { execSync } = require('child_process');
        try {
            execSync('npm install node-fetch@2', { stdio: 'inherit', cwd: __dirname });
            return true;
        } catch (installError) {
            console.error('❌ Failed to install node-fetch:', installError);
            return false;
        }
    }
}

ensureNodeFetch().then(success => {
    if (success) {
        testCustomerSignature().then(() => {
            console.log('\n🎉 Customer signature test complete!');
        }).catch(error => {
            console.error('💥 Test failed:', error);
        });
    }
});
