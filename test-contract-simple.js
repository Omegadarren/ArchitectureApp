// Simple test for the contract HTML endpoint
const fetch = require('node-fetch').default || require('node-fetch');

async function testContractHTML() {
    try {
        console.log('Testing contract HTML endpoint...');
        
        // First check if there are any contracts
        const contractsResponse = await fetch('http://localhost:3000/api/contracts');
        const contracts = await contractsResponse.json();
        console.log('Available contracts:', contracts.length);
        
        if (contracts.length > 0) {
            const testContractId = contracts[0].ContractID;
            console.log('Testing with contract ID:', testContractId);
            
            const htmlResponse = await fetch(`http://localhost:3000/api/contracts/${testContractId}/full-html`);
            console.log('Response status:', htmlResponse.status);
            
            if (htmlResponse.ok) {
                const html = await htmlResponse.text();
                console.log('✅ SUCCESS - Contract HTML generated');
                console.log('HTML length:', html.length);
                console.log('First 200 characters:', html.substring(0, 200));
            } else {
                const errorText = await htmlResponse.text();
                console.log('❌ ERROR - Response:', errorText);
            }
        } else {
            console.log('No contracts found to test with');
        }
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testContractHTML();
