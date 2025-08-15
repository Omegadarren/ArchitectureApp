# Email Setup Guide for Invoice Sending

The application is now configured to send actual emails! Follow these steps to set up email sending:

## Option 1: Gmail (Recommended - Easiest Setup)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account Settings → Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password (no spaces)

3. **Create `.env` file** in your project root (c:\ArchitectureApp\.env):
   ```
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_APP_PASSWORD=your-16-character-app-password
   EMAIL_FROM=Omega Builders LLC <your-gmail@gmail.com>
   ```

## Option 2: Outlook/Hotmail

1. **Create `.env` file**:
   ```
   EMAIL_USER=your-email@outlook.com
   EMAIL_PASSWORD=your-password
   EMAIL_FROM=Omega Builders LLC <your-email@outlook.com>
   ```

## Option 3: Business Email (Custom SMTP)

1. **Get SMTP settings** from your email provider
2. **Create `.env` file**:
   ```
   SMTP_HOST=smtp.your-domain.com
   SMTP_PORT=587
   EMAIL_USER=invoices@your-domain.com
   EMAIL_PASSWORD=your-password
   EMAIL_FROM=Omega Builders LLC <invoices@your-domain.com>
   ```

## Testing Email Configuration

1. **Test the configuration**:
   - Visit: http://localhost:3000/invoices/test-email
   - Should return: `{"success":true,"message":"Email configuration is valid"}`

2. **Send a test invoice**:
   - Go to an invoice in your app
   - Click "Email Invoice" 
   - Check your server console for email status

## What Happens Now

When you click "Send Invoice" from the email popup:

1. ✅ **Server generates a professional HTML email** with your invoice details
2. ✅ **Actually sends the email** to the customer's email address
3. ✅ **Updates invoice status** to "Sent" in the database
4. ✅ **Shows success/error messages** in the UI

## Email Features

- **Professional HTML design** matching your PDF styling
- **Responsive layout** that works on mobile devices
- **Complete invoice details** including line items and totals
- **Payment methods section** with all accepted payment types
- **Company branding** with Omega Builders LLC styling
- **Error handling** with user-friendly messages

## Troubleshooting

- **"Authentication failed"** → Check username/password in .env file
- **"Connection refused"** → Check SMTP host/port settings
- **"Rate limiting"** → Gmail has daily sending limits for free accounts
- **"Email not found"** → Ensure customer record has valid email address

## Production Recommendations

For high-volume sending, consider:
- **SendGrid** - Professional email service
- **Amazon SES** - AWS email service  
- **Mailgun** - Developer-friendly email API

The code structure supports easy switching to these services!
