// Simple test script that doesn't interfere with server signals
const http = require('http');

function testAPI() {
    console.log('Testing API endpoints...');
    
    // Test health endpoint
    const healthReq = http.get('http://localhost:3000/api/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('✅ Health endpoint response:', JSON.parse(data));
            
            // Test customers endpoint
            const customersReq = http.get('http://localhost:3000/api/customers', (res) => {
                let customerData = '';
                res.on('data', chunk => customerData += chunk);
                res.on('end', () => {
                    try {
                        const customers = JSON.parse(customerData);
                        console.log('✅ Customers endpoint response: Found', customers.length, 'customers');
                        console.log('First customer:', customers[0] ? customers[0].CompanyName : 'No customers found');
                    } catch (error) {
                        console.log('❌ Customers endpoint error:', error.message);
                    }
                    process.exit(0);
                });
            });
            
            customersReq.on('error', (error) => {
                console.log('❌ Customers API error:', error.message);
                process.exit(1);
            });
        });
    });
    
    healthReq.on('error', (error) => {
        console.log('❌ Health API error:', error.message);
        console.log('Make sure the server is running on port 3000');
        process.exit(1);
    });
}

// Wait a moment for server to be ready, then test
setTimeout(testAPI, 1000);
