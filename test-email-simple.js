// Quick email test
const { sendEmail, testEmailConfig } = require('./config/email');

async function testEmail() {
    console.log('Testing email configuration...');
    
    // Test the configuration first
    const configTest = await testEmailConfig();
    console.log('Config test result:', configTest);
    
    if (configTest.success) {
        console.log('Sending test email...');
        const emailTest = await sendEmail(
            'test@example.com', 
            'Test Email', 
            '<h1>Test email from contracts system</h1><p>This is a test.</p>'
        );
        console.log('Email test result:', emailTest);
    }
}

testEmail().catch(console.error);
