const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
require('dotenv').config();

const database = require('./config/database');

// Import route modules
const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const projectsRouter = require('./routes/projects');
const estimatesRouter = require('./routes/estimates');
const invoicesRouter = require('./routes/invoices');
const contractsRouter = require('./routes/contracts');
const paymentsRouter = require('./routes/payments');
const importRouter = require('./routes/import');
const lineItemsRouter = require('./routes/lineitems');
const settingsRouter = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));

// Session management
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory with no-cache for JS files
app.use('/js', (req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
}, express.static(path.join(__dirname, 'public/js')));
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route - redirect to login if not authenticated
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/login.html');
    }
});

// Login page - redirect to app if already authenticated
app.get('/login.html', (req, res) => {
    if (req.session && req.session.user) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// API Routes
app.use('/api/auth', authRouter);

// Protected routes - require authentication
const paytermsRouter = require('./routes/payterms');
app.use('/api/customers', authRouter.requireAuth, customersRouter);
app.use('/api/projects', authRouter.requireAuth, projectsRouter);
app.use('/api/estimates', authRouter.requireAuth, estimatesRouter);
app.use('/api/invoices', authRouter.requireAuth, invoicesRouter);
app.use('/api/contracts', authRouter.requireAuth, contractsRouter);
app.use('/api/payments', authRouter.requireAuth, paymentsRouter);
app.use('/api/payterms', authRouter.requireAuth, paytermsRouter);
app.use('/api/import', authRouter.requireAuth, importRouter);
app.use('/api/lineitems', authRouter.requireAuth, lineItemsRouter);
app.use('/api/settings', authRouter.requireAuth, settingsRouter);

// Customer contract signing page
app.get('/contract-signing/:contractId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contract-signing.html'));
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await database.query('SELECT 1 as test');
        res.json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
    }
});

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the application`);
    console.log(`Or visit http://<your-ip-address>:${PORT} from other devices`);
    
    try {
        await database.connect();
        console.log('Database connected successfully');
        
        // Check if Contracts table exists, create if not
        try {
            const tableCheck = await database.query(`
                SELECT COUNT(*) as tableCount 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'Contracts'
            `);
            
            if (tableCheck.recordset[0].tableCount === 0) {
                console.log('Creating Contracts table...');
                await database.query(`
                    CREATE TABLE Contracts (
                        ContractID INT IDENTITY(1,1) PRIMARY KEY,
                        ProjectID INT NOT NULL,
                        ContractNumber NVARCHAR(50) UNIQUE NOT NULL,
                        ContractType NVARCHAR(100),
                        ContractAmount DECIMAL(10,2) DEFAULT 0,
                        ContractStatus NVARCHAR(50) DEFAULT 'Draft',
                        SignedDate DATE NULL,
                        CreatedDate DATETIME DEFAULT GETDATE(),
                        ModifiedDate DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (ProjectID) REFERENCES Projects(ProjectID)
                    )
                `);
                console.log('✅ Contracts table created successfully');
            } else {
                console.log('✅ Contracts table already exists');
            }
        } catch (tableError) {
            console.log('⚠️ Could not check/create Contracts table:', tableError.message);
        }
    } catch (error) {
        console.error('Failed to connect to database:', error.message);
    }
});

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Don't exit, just log it
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit, just log it
});

// Improved graceful shutdown - only shutdown on explicit termination
let isShuttingDown = false;

process.on('SIGINT', async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\nReceived SIGINT (Ctrl+C), shutting down gracefully...');
    
    server.close(async () => {
        console.log('HTTP server closed');
        try {
            await database.close();
            console.log('Database connection closed');
        } catch (error) {
            console.error('Error closing database:', error);
        }
        process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.log('Force closing after timeout');
        process.exit(1);
    }, 10000);
});

process.on('SIGTERM', async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('Received SIGTERM, shutting down gracefully...');
    
    server.close(async () => {
        console.log('HTTP server closed');
        try {
            await database.close();
            console.log('Database connection closed');
        } catch (error) {
            console.error('Error closing database:', error);
        }
        process.exit(0);
    });
});

// Export the app for Vercel
module.exports = app;