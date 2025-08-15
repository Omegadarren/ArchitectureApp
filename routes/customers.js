const express = require('express');
const router = express.Router();
const database = require('../config/database');
const validator = require('../config/validator');

// Get all customers
router.get('/', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT CustomerID, CompanyName, ContactName, Phone, Email,
                   ContactName2, Phone2, Email2,
                   Address, City, State, ZipCode, Status, CreatedDate, ModifiedDate
            FROM Customers 
            ORDER BY CompanyName
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get single customer by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT CustomerID, CompanyName, ContactName, Phone, Email,
                   ContactName2, Phone2, Email2,
                   Address, City, State, ZipCode, Status, CreatedDate, ModifiedDate
            FROM Customers 
            WHERE CustomerID = @customerId
        `, { customerId: req.params.id });
        
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
        // Validate input data
        const validation = validator.validateCustomer(req.body);
        if (!validation.isValid) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: validation.errors 
            });
        }

        const { CompanyName, ContactName, Phone, Email, ContactName2, Phone2, Email2, Address, City, State, ZipCode, Status } = req.body;
        
        const result = await database.query(`
            INSERT INTO Customers (CompanyName, ContactName, Phone, Email, ContactName2, Phone2, Email2, Address, City, State, ZipCode, Status)
            OUTPUT INSERTED.CustomerID, INSERTED.CompanyName, INSERTED.ContactName, 
                   INSERTED.Phone, INSERTED.Email, INSERTED.ContactName2, INSERTED.Phone2, INSERTED.Email2,
                   INSERTED.Address, INSERTED.City, 
                   INSERTED.State, INSERTED.ZipCode, INSERTED.Status, INSERTED.CreatedDate, INSERTED.ModifiedDate
            VALUES (@companyName, @contactName, @phone, @email, @contactName2, @phone2, @email2, @address, @city, @state, @zipCode, @status)
        `, {
            companyName: validator.sanitizeInput(CompanyName),
            contactName: validator.sanitizeInput(ContactName) || null,
            phone: validator.sanitizeInput(Phone) || null,
            email: validator.sanitizeInput(Email) || null,
            contactName2: validator.sanitizeInput(ContactName2) || null,
            phone2: validator.sanitizeInput(Phone2) || null,
            email2: validator.sanitizeInput(Email2) || null,
            address: validator.sanitizeInput(Address) || null,
            city: validator.sanitizeInput(City) || null,
            state: validator.sanitizeInput(State) || null,
            zipCode: validator.sanitizeInput(ZipCode) || null,
            status: validator.sanitizeInput(Status) || 'active'
        });
        
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
    const { CompanyName, ContactName, Phone, Email, ContactName2, Phone2, Email2, Address, City, State, ZipCode, Status } = req.body;
        
        if (!CompanyName) {
            return res.status(400).json({ error: 'Company name is required' });
        }
        
        const result = await database.query(`
            UPDATE Customers 
            SET CompanyName = @companyName, 
                ContactName = @contactName, 
                Phone = @phone, 
                Email = @email, 
                ContactName2 = @contactName2,
                Phone2 = @phone2,
                Email2 = @email2,
                Address = @address, 
                City = @city, 
                State = @state, 
                ZipCode = @zipCode,
                Status = @status,
                ModifiedDate = GETDATE()
            OUTPUT INSERTED.CustomerID, INSERTED.CompanyName, INSERTED.ContactName, 
                   INSERTED.Phone, INSERTED.Email, INSERTED.ContactName2, INSERTED.Phone2, INSERTED.Email2,
                   INSERTED.Address, INSERTED.City, 
                   INSERTED.State, INSERTED.ZipCode, INSERTED.Status, INSERTED.CreatedDate, INSERTED.ModifiedDate
            WHERE CustomerID = @customerId
        `, {
            customerId: req.params.id,
            companyName: CompanyName,
            contactName: ContactName || null,
            phone: Phone || null,
            email: Email || null,
            contactName2: ContactName2 || null,
            phone2: Phone2 || null,
            email2: Email2 || null,
            address: Address || null,
            city: City || null,
            state: State || null,
            zipCode: ZipCode || null,
            status: Status || 'active'
        });
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Delete customer
router.delete('/:id', async (req, res) => {
    try {
        // Check if customer has associated projects
        const projectCheck = await database.query(`
            SELECT COUNT(*) as projectCount FROM Projects WHERE CustomerID = @customerId
        `, { customerId: req.params.id });
        
        if (projectCheck.recordset[0].projectCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete customer with associated projects. Delete projects first.' 
            });
        }
        
        const result = await database.query(`
            DELETE FROM Customers WHERE CustomerID = @customerId
        `, { customerId: req.params.id });
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// Get customer projects
router.get('/:id/projects', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT ProjectID, ProjectName, ProjectDescription, ProjectAddress, 
                   ProjectCity, ProjectState, ProjectZip, StartDate, 
                   EstimatedCompletionDate, ActualCompletionDate, ProjectStatus, 
                   TotalContractAmount, CreatedDate, ModifiedDate
            FROM Projects 
            WHERE CustomerID = @customerId
            ORDER BY CreatedDate DESC
        `, { customerId: req.params.id });
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching customer projects:', error);
        res.status(500).json({ error: 'Failed to fetch customer projects' });
    }
});

module.exports = router;