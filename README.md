# Architecture Project Management System

A complete project management system for architecture firms with customer tracking, project management, estimates, invoices, and contracts.

## 🚀 Quick Start

1. **Install Dependencies**
   ```powershell
   npm install
   ```

2. **Check System Health**
   ```powershell
   npm run health
   ```

3. **Start the Server**
   ```powershell
   npm start
   ```

4. **Open in Browser**
   Navigate to: http://localhost:3000

## 🛠️ Setup Instructions

### Database Configuration

The app connects to Azure SQL Database. Ensure your `.env` file has the correct database credentials:

```env
DB_SERVER=your-server.database.windows.net
DB_DATABASE=ArchitectureDB
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
```

### Email Configuration

For email functionality (contract signing, notifications), configure Gmail:

1. Enable 2-Factor Authentication on your Google Account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Update your `.env` file:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-16-character-app-password
EMAIL_FROM=Your Company <your-email@gmail.com>
```

## 🔧 Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start development server with auto-reload |
| `npm run health` | Run comprehensive health check |
| `npm run test-db` | Test database connection |
| `npm run test-email` | Test email configuration |
| `npm run setup` | Install dependencies and run health check |

## 📊 Features

- **Customer Management**: Track customer information and contact details
- **Project Management**: Monitor project status, dates, and budgets
- **Estimates**: Create and manage project estimates
- **Invoices**: Generate and track invoices
- **Contracts**: Digital contract signing workflow
- **Payments**: Track payment history
- **Reports**: Business intelligence and analytics
- **Import/Export**: Excel file import functionality

## 🏗️ Architecture

```
├── server.js                 # Main server file
├── config/
│   ├── database.js           # Database connection
│   └── email.js              # Email configuration
├── routes/
│   ├── customers.js          # Customer API endpoints
│   ├── projects.js           # Project API endpoints
│   ├── estimates.js          # Estimates API endpoints
│   ├── invoices.js           # Invoices API endpoints
│   ├── contracts.js          # Contracts API endpoints
│   └── payments.js           # Payments API endpoints
└── public/
    ├── index.html            # Main application UI
    ├── css/style.css         # Styling
    └── js/app.js             # Frontend JavaScript
```

## 🗄️ Database Tables

- **Customers**: Customer information and contacts
- **Projects**: Project details and status
- **Estimates**: Project estimates and line items
- **Invoices**: Invoice tracking and payments
- **Contracts**: Contract management and signing
- **Payments**: Payment history and tracking
- **PayTerms**: Payment term definitions
- **ChangeOrders**: Project change orders

## 🛡️ Security Features

- Parameterized SQL queries prevent SQL injection
- Environment variable configuration
- Input validation and sanitization
- Secure email handling

## 🚨 Troubleshooting

### Common Issues

1. **Port 3000 already in use**
   ```powershell
   netstat -ano | findstr :3000
   taskkill /PID <process-id> /F
   ```

2. **Database connection fails**
   - Check your Azure SQL Database credentials
   - Ensure firewall allows your IP address
   - Run `npm run test-db` to diagnose

3. **Email authentication fails**
   - Generate a new Gmail App Password
   - Ensure 2FA is enabled on Gmail
   - Run `npm run test-email` to test

4. **Missing tables error**
   - Tables are created automatically on first run
   - Check database permissions
   - Run the health check: `npm run health`

### Getting Help

If you encounter issues:

1. Run the health check: `npm run health`
2. Check the console output for specific error messages
3. Verify your `.env` file configuration
4. Ensure all dependencies are installed: `npm install`

## 📝 Recent Fixes Applied

✅ **Email Authentication**: Improved Gmail App Password handling  
✅ **Server Stability**: Fixed graceful shutdown issues  
✅ **Database Connections**: Prevented multiple connection attempts  
✅ **Error Handling**: Enhanced error messages and validation  
✅ **Health Monitoring**: Added comprehensive health check system  

## 🔄 Version History

- **v1.0.0**: Initial release with full project management features
- **v1.0.1**: Fixed email authentication and server stability issues
