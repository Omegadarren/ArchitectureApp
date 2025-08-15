const http = require('http');

const postData = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/contracts/4/send-to-customer',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📧 Testing contract email sending...');

const req = http.request(options, (res) => {
  console.log('✅ Response Status:', res.statusCode);
  console.log('📋 Response Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📧 Email Response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('📧 Raw Response:', data);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('❌ Request Error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
