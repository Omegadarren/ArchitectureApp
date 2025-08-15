// Quick test of contracts API
const http = require('http');

function testContractsAPI() {
    console.log('Testing contracts API...');
    
    const req = http.get('http://localhost:3000/api/contracts', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const contracts = JSON.parse(data);
                console.log('✅ Contracts API Response Type:', Array.isArray(contracts) ? 'Array' : typeof contracts);
                console.log('✅ Contracts Count:', Array.isArray(contracts) ? contracts.length : 'N/A');
                if (Array.isArray(contracts) && contracts.length > 0) {
                    console.log('✅ Sample contract keys:', Object.keys(contracts[0]));
                } else {
                    console.log('ℹ️ No contracts found in database');
                }
            } catch (error) {
                console.log('❌ Invalid JSON response:', data);
            }
            process.exit(0);
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ API test failed:', error.message);
        process.exit(1);
    });
}

setTimeout(testContractsAPI, 1000);
