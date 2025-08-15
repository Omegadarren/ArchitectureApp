const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// Import route modules
const authRouter = require('../routes/auth');
const customersRouter = require('../routes/customers');
const projectsRouter = require('../routes/projects');
const estimatesRouter = require('../routes/estimates');
const invoicesRouter = require('../routes/invoices');
const contractsRouter = require('../routes/contracts');
const paymentsRouter = require('../routes/payments');
const importRouter = require('../routes/import');
const lineItemsRouter = require('../routes/lineitems');
const settingsRouter = require('../routes/settings');

const app = express();

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));

// Session management
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: '/tmp'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/import', importRouter);
app.use('/api/lineitems', lineItemsRouter);
app.use('/api/settings', settingsRouter);

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Handle all other routes
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    }
});

module.exports = app;
