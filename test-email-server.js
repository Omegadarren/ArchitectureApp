// Simple test server just for email testing
const express = require('express');
const { sendEmail, testEmailConfig } = require('./config/email');
const database = require('./config/database');

const app = express();
app.use(express.json());

// Test email endpoint
app.post('/test-send-contract', async (req, res) => {
    try {
        console.log('🧪 Testing contract email sending...');
        
        // Test email config first
        const configTest = await testEmailConfig();
        console.log('Config test:', configTest);
        
        if (!configTest.success) {
            return res.status(500).json({ error: 'Email config failed', details: configTest.error });
        }
        
        // Mock contract data for testing
        const mockContract = {
            ContractNumber: 'DES-0001',
            ProjectName: 'Test Project',
            ContactName: 'Test Customer',
            Email: 'omegabuildersinvoice@gmail.com' // Send to our own email for testing
        };
        
        const signingUrl = 'http://localhost:3000/contract-signing/1';
        
        const subject = `Contract Ready for Your Signature - ${mockContract.ContractNumber}`;
        const htmlContent = `
            <h1>OMEGA BUILDERS, LLC</h1>
            <h2>Contract Ready for Your Digital Signature</h2>
            <p>Dear ${mockContract.ContactName},</p>
            <p>Your design contract for <strong>${mockContract.ProjectName}</strong> is ready for your digital signature.</p>
            <p><strong>Contract Number:</strong> ${mockContract.ContractNumber}</p>
            <p><strong>Project:</strong> ${mockContract.ProjectName}</p>
            <p><a href="${signingUrl}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none;">SIGN CONTRACT NOW</a></p>
            <p>Best regards,<br>Omega Builders, LLC</p>
        `;

        const result = await sendEmail(mockContract.Email, subject, htmlContent);
        console.log('📧 Email result:', result);
        
        if (result.success) {
            res.json({ success: true, message: 'Test email sent successfully', result });
        } else {
            res.status(500).json({ success: false, error: 'Failed to send email', details: result.error });
        }
        
    } catch (error) {
        console.error('❌ Test email error:', error);
        res.status(500).json({ error: 'Test failed', details: error.message });
    }
});

// Start server
app.listen(3001, () => {
    console.log('🧪 Test server running on port 3001');
    console.log('POST http://localhost:3001/test-send-contract to test email');
});

module.exports = app;
