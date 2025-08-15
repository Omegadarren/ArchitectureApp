const express = require('express');
const router = express.Router();
const database = require('../config/database');
const settingsHelper = require('../utils/settingsHelper');

// Get all line items templates
router.get('/', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT LineItemID, ItemCode, ItemName, ItemDescription, 
                   Category, UnitOfMeasure, StandardRate, IsActive,
                   CreatedDate, ModifiedDate
            FROM LineItemsMaster
            WHERE IsActive = 1
            ORDER BY Category, ItemName
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching line items:', error);
        res.status(500).json({ error: 'Failed to fetch line items' });
    }
});

// Create new line item template
router.post('/', async (req, res) => {
    try {
        const { ItemCode, ItemName, ItemDescription, Category, UnitOfMeasure, StandardRate } = req.body;
        
        // Validation
        if (!ItemName || !ItemDescription) {
            return res.status(400).json({ error: 'Item name and description are required' });
        }

        // Get settings for default values
        const settings = await settingsHelper.getSettings();
        const defaultRate = StandardRate || settings.hourly_rate || 0;
        
        // Generate ItemCode if not provided
        const finalItemCode = ItemCode || ItemName.replace(/\s+/g, '_').toUpperCase();
        
        const result = await database.query(`
            INSERT INTO LineItemsMaster (ItemCode, ItemName, ItemDescription, Category, UnitOfMeasure, StandardRate, IsActive, CreatedDate, ModifiedDate)
            VALUES (@itemCode, @itemName, @itemDescription, @category, @unitOfMeasure, @standardRate, 1, GETDATE(), GETDATE());
            SELECT SCOPE_IDENTITY() as LineItemID;
        `, {
            itemCode: finalItemCode,
            itemName: ItemName,
            itemDescription: ItemDescription,
            category: Category || 'Custom',
            unitOfMeasure: UnitOfMeasure || 'hrs',
            standardRate: defaultRate
        });
        
        const lineItemId = result.recordset[0].LineItemID;
        
        // Return the created item
        const newItem = await database.query(`
            SELECT LineItemID, ItemCode, ItemName, ItemDescription, 
                   Category, UnitOfMeasure, StandardRate, IsActive
            FROM LineItemsMaster
            WHERE LineItemID = @lineItemId
        `, { lineItemId });
        
        res.status(201).json(newItem.recordset[0]);
    } catch (error) {
        console.error('Error creating line item template:', error);
        
        // Check for duplicate ItemCode
        if (error.message && error.message.includes('duplicate')) {
            return res.status(400).json({ error: 'Item code already exists' });
        }
        
        res.status(500).json({ error: 'Failed to create line item template' });
    }
});

// Update line item template
router.put('/:id', async (req, res) => {
    try {
        const lineItemId = parseInt(req.params.id);
        const { ItemCode, ItemName, ItemDescription, Category, UnitOfMeasure, StandardRate } = req.body;
        
        if (isNaN(lineItemId)) {
            return res.status(400).json({ error: 'Invalid line item ID' });
        }
        
        // Validation
        if (!ItemName || !ItemDescription) {
            return res.status(400).json({ error: 'Item name and description are required' });
        }

        await database.query(`
            UPDATE LineItemsMaster 
            SET ItemCode = @itemCode,
                ItemName = @itemName,
                ItemDescription = @itemDescription,
                Category = @category,
                UnitOfMeasure = @unitOfMeasure,
                StandardRate = @standardRate,
                ModifiedDate = GETDATE()
            WHERE LineItemID = @lineItemId
        `, {
            lineItemId,
            itemCode: ItemCode,
            itemName: ItemName,
            itemDescription: ItemDescription,
            category: Category,
            unitOfMeasure: UnitOfMeasure,
            standardRate: StandardRate
        });
        
        // Return the updated item
        const updatedItem = await database.query(`
            SELECT LineItemID, ItemCode, ItemName, ItemDescription, 
                   Category, UnitOfMeasure, StandardRate, IsActive
            FROM LineItemsMaster
            WHERE LineItemID = @lineItemId
        `, { lineItemId });
        
        if (updatedItem.recordset.length === 0) {
            return res.status(404).json({ error: 'Line item template not found' });
        }
        
        res.json(updatedItem.recordset[0]);
    } catch (error) {
        console.error('Error updating line item template:', error);
        res.status(500).json({ error: 'Failed to update line item template' });
    }
});

// Delete line item template (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const lineItemId = parseInt(req.params.id);
        
        if (isNaN(lineItemId)) {
            return res.status(400).json({ error: 'Invalid line item ID' });
        }
        
        // Soft delete - mark as inactive
        await database.query(`
            UPDATE LineItemsMaster 
            SET IsActive = 0, ModifiedDate = GETDATE()
            WHERE LineItemID = @lineItemId
        `, { lineItemId });
        
        res.json({ message: 'Line item template deleted successfully' });
    } catch (error) {
        console.error('Error deleting line item template:', error);
        res.status(500).json({ error: 'Failed to delete line item template' });
    }
});

module.exports = router;
