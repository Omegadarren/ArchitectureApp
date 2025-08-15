// Test contract creation
const fetch = require('node-fetch');

async function testContractCreation() {
    try {
        console.log('🧪 Testing contract creation...');
        
        // Test data - using a valid project ID
        const testData = {
            ProjectID: 4, // Assuming this project exists
            ContractType: 'Design Contract',
            ContractAmount: 1500.00,
            ContractStatus: 'Draft'
        };
        
        console.log('📤 Sending request with data:', testData);
        
        const response = await fetch('http://localhost:3000/api/contracts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', response.headers.raw());
        
        const responseText = await response.text();
        console.log('📡 Raw response:', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('✅ Parsed result:', result);
        } catch (parseError) {
            console.log('❌ Failed to parse JSON:', parseError.message);
            console.log('Raw text was:', responseText);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testContractCreation();
