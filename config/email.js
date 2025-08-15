const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
    // Option 1: Gmail (requires App Password)
    gmail: {
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || 'your-email@gmail.com',
            pass: process.env.EMAIL_APP_PASSWORD || 'your-app-password'
        }
    },
    
    // Option 2: Outlook/Hotmail
    outlook: {
        service: 'hotmail',
        auth: {
            user: process.env.EMAIL_USER || 'your-email@outlook.com',
            pass: process.env.EMAIL_PASSWORD || 'your-password'
        }
    },
    
    // Option 3: Custom SMTP (for business email)
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.your-domain.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER || 'your-email@your-domain.com',
            pass: process.env.EMAIL_PASSWORD || 'your-password'
        }
    }
};

// Create transporter based on environment or default to Gmail
let transporter;

function createTransporter(provider = 'gmail') {
    try {
        transporter = nodemailer.createTransport(emailConfig[provider]);
        console.log(`📧 Email transporter created using ${provider}`);
        return transporter;
    } catch (error) {
        console.error('Error creating email transporter:', error);
        return null;
    }
}

// Send email function
async function sendEmail(to, subject, htmlContent, pdfAttachment = null) {
    try {
        // Check if email is properly configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn('⚠️ Email not configured - skipping email send');
            return { 
                success: false, 
                error: 'Email configuration missing. Please set EMAIL_USER and EMAIL_APP_PASSWORD in .env file.' 
            };
        }

        if (!transporter) {
            transporter = createTransporter();
        }

        if (!transporter) {
            throw new Error('Email transporter not configured');
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@omega-builders.com',
            to: to,
            subject: subject,
            html: htmlContent
        };

        // Add PDF attachment if provided
        if (pdfAttachment) {
            mailOptions.attachments = [{
                filename: pdfAttachment.filename,
                content: pdfAttachment.content,
                contentType: 'application/pdf'
            }];
        }

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('❌ Email sending failed:', error);
        
        // Provide helpful error messages for common issues
        if (error.code === 'EAUTH') {
            return { 
                success: false, 
                error: 'Email authentication failed. Please verify your Gmail App Password is correct and 2FA is enabled.' 
            };
        }
        
        return { success: false, error: error.message };
    }
}

// Test email configuration
async function testEmailConfig() {
    try {
        if (!transporter) {
            transporter = createTransporter();
        }

        if (!transporter) {
            return { success: false, error: 'Transporter not configured' };
        }

        await transporter.verify();
        console.log('✅ Email configuration is valid');
        return { success: true, message: 'Email configuration is valid' };

    } catch (error) {
        console.error('❌ Email configuration test failed:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    createTransporter,
    sendEmail,
    testEmailConfig
};
