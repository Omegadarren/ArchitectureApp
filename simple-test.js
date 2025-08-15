const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Simple test without database
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working without database' });
});

// Test with minimal database connection
app.get('/api/customers', async (req, res) => {
    try {
        res.json([
            { CustomerID: 1, CompanyName: 'Test Company', ContactName: 'Test Contact' }
        ]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Simple test server running on port ${PORT}`);
});
