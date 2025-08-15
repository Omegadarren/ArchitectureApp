// Test script to verify the contract HTML endpoint
const http = require('http');

const testContractId = 4; // You can change this to test different contracts

const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/contracts/${testContractId}/full-html`,
    method: 'GET',
    headers: {
        'Accept': 'text/html'
    }
};

console.log(`Testing contract HTML endpoint: http://localhost:3000${options.path}`);

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`\nResponse Length: ${data.length} characters`);
        
        if (res.statusCode === 200) {
            console.log('\n✅ SUCCESS - Contract HTML generated');
            console.log('\nFirst 500 characters of response:');
            console.log('-'.repeat(50));
            console.log(data.substring(0, 500));
            console.log('-'.repeat(50));
        } else {
            console.log('\n❌ ERROR - Failed to generate contract HTML');
            console.log('Response:', data);
        }
    });
});

req.on('error', (err) => {
    console.log('❌ Request Error:', err.message);
});

req.end();
