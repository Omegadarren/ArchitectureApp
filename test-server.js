const express = require('express');
const cors = require('cors');
require('dotenv').config();

const database = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working' });
});

// Test database connection
app.get('/api/customers', async (req, res) => {
    try {
        console.log('Testing customers endpoint...');
        const result = await database.query('SELECT TOP 5 * FROM Customers');
        console.log('Query result:', result.recordset);
        res.json(result.recordset);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);
    try {
        await database.connect();
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Failed to connect to database:', error.message);
    }
});
