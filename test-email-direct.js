// Direct email test without server
const { sendEmail, testEmailConfig } = require('./config/email');

async function testEmailDirect() {
    try {
        console.log('🧪 Testing email configuration...');
        
        // Test the configuration first
        const configTest = await testEmailConfig();
        console.log('📧 Config test result:', configTest);
        
        if (!configTest.success) {
            console.error('❌ Email configuration failed:', configTest.error);
            return;
        }
        
        console.log('✅ Email configuration is valid, sending test email...');
        
        // Send test email
        const subject = 'Contract Email Test - DES-0001';
        const htmlContent = `
            <h1>OMEGA BUILDERS, LLC</h1>
            <h2>Contract Ready for Your Digital Signature</h2>
            <p>Dear Test Customer,</p>
            <p>Your design contract for <strong>Test Project</strong> is ready for your digital signature.</p>
            <p><strong>Contract Number:</strong> DES-0001</p>
            <p><strong>Project:</strong> Test Project</p>
            <p><a href="http://localhost:3000/contract-signing/1" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none;">SIGN CONTRACT NOW</a></p>
            <p>Best regards,<br>Omega Builders, LLC</p>
        `;

        const result = await sendEmail('omegabuildersinvoice@gmail.com', subject, htmlContent);
        console.log('📧 Email send result:', result);
        
        if (result.success) {
            console.log('✅ Email sent successfully!');
        } else {
            console.error('❌ Email sending failed:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Direct email test error:', error);
    }
}

testEmailDirect();
