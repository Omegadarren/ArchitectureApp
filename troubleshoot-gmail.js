// Gmail troubleshooting script
const nodemailer = require('nodemailer');
require('dotenv').config();

async function troubleshootGmail() {
    console.log('🔍 Gmail Configuration Troubleshooting');
    console.log('=====================================');
    
    // Check environment variables
    console.log('📧 Email User:', process.env.EMAIL_USER || 'NOT SET');
    console.log('🔑 App Password Length:', process.env.EMAIL_APP_PASSWORD ? process.env.EMAIL_APP_PASSWORD.length : 'NOT SET');
    console.log('🔑 App Password (masked):', process.env.EMAIL_APP_PASSWORD ? process.env.EMAIL_APP_PASSWORD.replace(/./g, '*') : 'NOT SET');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.log('❌ Email credentials not found in .env file');
        return;
    }
    
    if (process.env.EMAIL_APP_PASSWORD.length !== 16) {
        console.log('⚠️  Warning: Gmail App Passwords should be exactly 16 characters');
    }
    
    // Test different configurations
    const configs = [
        {
            name: 'Gmail Service (Default)',
            config: {
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_APP_PASSWORD
                }
            }
        },
        {
            name: 'Gmail SMTP Direct',
            config: {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_APP_PASSWORD
                }
            }
        }
    ];
    
    for (const test of configs) {
        console.log(`\n🧪 Testing: ${test.name}`);
        try {
            const transporter = nodemailer.createTransport(test.config);
            await transporter.verify();
            console.log(`✅ ${test.name}: SUCCESS`);
            return; // Stop on first success
        } catch (error) {
            console.log(`❌ ${test.name}: ${error.message}`);
        }
    }
    
    console.log('\n💡 Troubleshooting Tips:');
    console.log('1. Go to https://myaccount.google.com/security');
    console.log('2. Make sure 2-Step Verification is ON');
    console.log('3. Go to https://myaccount.google.com/apppasswords');
    console.log('4. Generate a NEW app password for "Mail"');
    console.log('5. Copy the 16-character password (no spaces)');
    console.log('6. Update EMAIL_APP_PASSWORD in your .env file');
}

troubleshootGmail().catch(console.error);
