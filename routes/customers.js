const express = require('express');
const database = require('../config/database');
const router = express.Router();

// Get all customers
router.get('/', async (req, res) => {
    try {
        const result = await database.query('SELECT * FROM Customers ORDER BY LastName, FirstName');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await database.query('SELECT * FROM Customers WHERE CustomerID = ?', [req.params.id]);
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create new customer
router.post('/', async (req, res) => {
    try {
        const { FirstName, LastName, CompanyName, Email, Phone, Address, City, State, Zip } = req.body;
        
        const result = await database.query(
            INSERT INTO Customers (FirstName, LastName, CompanyName, Email, Phone, Address, City, State, Zip)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        , [FirstName, LastName, CompanyName, Email, Phone, Address, City, State, Zip]);
        
        res.status(201).json({ message: 'Customer created successfully', id: result.lastID });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

module.exports = router;
