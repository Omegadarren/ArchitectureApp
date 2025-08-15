const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Get all pay terms
router.get('/', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT pt.PayTermID, pt.ProjectID, pt.EstimateID, pt.PayTermType, 
                   pt.PayTermName, pt.PercentageAmount, pt.FixedAmount, pt.DueDate, 
                   pt.PayTermDescription, pt.PayTermStatus, pt.CreatedDate, pt.ModifiedDate,
                   e.EstimateNumber, e.TotalAmount as EstimateTotal,
                   p.ProjectName, c.CompanyName as CustomerName
            FROM PayTerms pt
            LEFT JOIN Estimates e ON pt.EstimateID = e.EstimateID
            LEFT JOIN Projects p ON pt.ProjectID = p.ProjectID
            LEFT JOIN Customers c ON p.CustomerID = c.CustomerID
            ORDER BY pt.CreatedDate DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching all pay terms:', error);
        res.status(500).json({ error: 'Failed to fetch pay terms' });
    }
});

// Get all pay terms for a project
router.get('/project/:projectId', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT pt.PayTermID, pt.ProjectID, pt.EstimateID, pt.PayTermType, 
                   pt.PayTermName, pt.PercentageAmount, pt.FixedAmount, pt.DueDate, 
                   pt.PayTermDescription, pt.PayTermStatus, pt.CreatedDate, pt.ModifiedDate,
                   e.EstimateNumber, e.TotalAmount as EstimateTotal
            FROM PayTerms pt
            LEFT JOIN Estimates e ON pt.EstimateID = e.EstimateID
            WHERE pt.ProjectID = @projectId
            ORDER BY pt.DueDate ASC, pt.CreatedDate ASC
        `, { projectId: req.params.projectId });
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching pay terms:', error);
        res.status(500).json({ error: 'Failed to fetch pay terms' });
    }
});

// Get pay terms for an estimate
router.get('/estimate/:estimateId', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT pt.PayTermID, pt.ProjectID, pt.EstimateID, pt.PayTermType, 
                   pt.PayTermName, pt.PercentageAmount, pt.FixedAmount, pt.DueDate, 
                   pt.PayTermDescription, pt.PayTermStatus, pt.CreatedDate, pt.ModifiedDate,
                   e.EstimateNumber, e.TotalAmount as EstimateTotal
            FROM PayTerms pt
            LEFT JOIN Estimates e ON pt.EstimateID = e.EstimateID
            WHERE pt.EstimateID = @estimateId
            ORDER BY pt.DueDate ASC, pt.CreatedDate ASC
        `, { estimateId: req.params.estimateId });
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching pay terms:', error);
        res.status(500).json({ error: 'Failed to fetch pay terms' });
    }
});

// Get single pay term by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT pt.PayTermID, pt.ProjectID, pt.EstimateID, pt.PayTermType, 
                   pt.PayTermName, pt.PercentageAmount, pt.FixedAmount, pt.DueDate, 
                   pt.PayTermDescription, pt.PayTermStatus, pt.CreatedDate, pt.ModifiedDate,
                   p.ProjectName, e.EstimateNumber
            FROM PayTerms pt
            LEFT JOIN Projects p ON pt.ProjectID = p.ProjectID
            LEFT JOIN Estimates e ON pt.EstimateID = e.EstimateID
            WHERE pt.PayTermID = @payTermId
        `, { payTermId: req.params.id });
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Pay term not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching pay term:', error);
        res.status(500).json({ error: 'Failed to fetch pay term' });
    }
});

// Create standard pay terms from estimate
router.post('/create-standard', async (req, res) => {
    try {
        const { projectId, estimateId, paymentType } = req.body;
        
        if (!projectId || !estimateId || !paymentType) {
            return res.status(400).json({ error: 'Project ID, Estimate ID, and payment type are required' });
        }
        
        // Get estimate total
        const estimateResult = await database.query(`
            SELECT TotalAmount FROM Estimates WHERE EstimateID = @estimateId
        `, { estimateId });
        
        if (estimateResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }
        
        const estimateTotal = estimateResult.recordset[0].TotalAmount;
        const payTerms = [];
        
        if (paymentType === '100_at_acceptance') {
            // 100% due now
            payTerms.push({
                projectId,
                estimateId,
                payTermType: 'Due Now',
                payTermName: 'Due now',
                percentageAmount: 100,
                fixedAmount: estimateTotal,
                payTermDescription: '100% of estimate total due now',
                payTermStatus: 'Pending'
            });
        } else if (paymentType === '75_25_split') {
            // 75% due now, 25% at permit submittal
            const firstPayment = estimateTotal * 0.75;
            const secondPayment = estimateTotal * 0.25;
            
            payTerms.push({
                projectId,
                estimateId,
                payTermType: 'Due Now',
                payTermName: 'Due now',
                percentageAmount: 75,
                fixedAmount: firstPayment,
                payTermDescription: '75% of estimate total due now',
                payTermStatus: 'Pending'
            });
            
            payTerms.push({
                projectId,
                estimateId,
                payTermType: 'Permit Submittal',
                payTermName: 'Due prior to permit submittal',
                percentageAmount: 25,
                fixedAmount: secondPayment,
                payTermDescription: '25% of estimate total (remaining balance) due prior to permit submittal or submittal to engineer',
                payTermStatus: 'Pending'
            });
        }
        
        // Insert pay terms
        const results = [];
        for (const payTerm of payTerms) {
            const result = await database.query(`
                INSERT INTO PayTerms (ProjectID, EstimateID, PayTermType, PayTermName, 
                                    PercentageAmount, FixedAmount, PayTermDescription, PayTermStatus)
                OUTPUT INSERTED.PayTermID, INSERTED.ProjectID, INSERTED.EstimateID, 
                       INSERTED.PayTermType, INSERTED.PayTermName, INSERTED.PercentageAmount, 
                       INSERTED.FixedAmount, INSERTED.DueDate, INSERTED.PayTermDescription, 
                       INSERTED.PayTermStatus, INSERTED.CreatedDate, INSERTED.ModifiedDate
                VALUES (@projectId, @estimateId, @payTermType, @payTermName, 
                        @percentageAmount, @fixedAmount, @payTermDescription, @payTermStatus)
            `, payTerm);
            results.push(result.recordset[0]);
        }
        
        res.status(201).json(results);
    } catch (error) {
        console.error('Error creating pay terms:', error);
        res.status(500).json({ error: 'Failed to create pay terms' });
    }
});

// Create multiple pay terms from inline form
router.post('/create-multiple', async (req, res) => {
    try {
        const { payTerms } = req.body;
        
        if (!payTerms || !Array.isArray(payTerms) || payTerms.length === 0) {
            return res.status(400).json({ error: 'Pay terms array is required' });
        }
        
        // Insert pay terms
        const results = [];
        for (const payTerm of payTerms) {
            const { PayTermName, PayTermAmount, PayTermStatus, ProjectID, EstimateID } = payTerm;
            
            if (!ProjectID || !PayTermName || !PayTermAmount) {
                return res.status(400).json({ error: 'Project ID, pay term name, and amount are required for each pay term' });
            }
            
            const result = await database.query(`
                INSERT INTO PayTerms (ProjectID, EstimateID, PayTermType, PayTermName, 
                                    PercentageAmount, FixedAmount, PayTermDescription, PayTermStatus)
                OUTPUT INSERTED.PayTermID, INSERTED.ProjectID, INSERTED.EstimateID, 
                       INSERTED.PayTermType, INSERTED.PayTermName, INSERTED.PercentageAmount, 
                       INSERTED.FixedAmount, INSERTED.DueDate, INSERTED.PayTermDescription, 
                       INSERTED.PayTermStatus, INSERTED.CreatedDate, INSERTED.ModifiedDate
                VALUES (@projectId, @estimateId, @payTermType, @payTermName, 
                        @percentageAmount, @fixedAmount, @payTermDescription, @payTermStatus)
            `, {
                projectId: ProjectID,
                estimateId: EstimateID || null,
                payTermType: 'Milestone',
                payTermName: PayTermName,
                percentageAmount: null,
                fixedAmount: PayTermAmount,
                payTermDescription: PayTermName,
                payTermStatus: PayTermStatus || 'Pending'
            });
            results.push(result.recordset[0]);
        }
        
        res.status(201).json(results);
    } catch (error) {
        console.error('Error creating multiple pay terms:', error);
        res.status(500).json({ error: 'Failed to create pay terms' });
    }
});

// Create custom pay term
router.post('/', async (req, res) => {
    try {
        const { 
            projectId, estimateId, payTermType, payTermName, 
            percentageAmount, fixedAmount, dueDate, 
            payTermDescription, payTermStatus 
        } = req.body;
        
        if (!projectId || !payTermType || !payTermName) {
            return res.status(400).json({ error: 'Project ID, pay term type, and name are required' });
        }
        
        const result = await database.query(`
            INSERT INTO PayTerms (ProjectID, EstimateID, PayTermType, PayTermName, 
                                PercentageAmount, FixedAmount, DueDate, 
                                PayTermDescription, PayTermStatus)
            OUTPUT INSERTED.PayTermID, INSERTED.ProjectID, INSERTED.EstimateID, 
                   INSERTED.PayTermType, INSERTED.PayTermName, INSERTED.PercentageAmount, 
                   INSERTED.FixedAmount, INSERTED.DueDate, INSERTED.PayTermDescription, 
                   INSERTED.PayTermStatus, INSERTED.CreatedDate, INSERTED.ModifiedDate
            VALUES (@projectId, @estimateId, @payTermType, @payTermName, 
                    @percentageAmount, @fixedAmount, @dueDate, @payTermDescription, @payTermStatus)
        `, {
            projectId,
            estimateId: estimateId || null,
            payTermType,
            payTermName,
            percentageAmount: percentageAmount || null,
            fixedAmount: fixedAmount || null,
            dueDate: dueDate || null,
            payTermDescription: payTermDescription || null,
            payTermStatus: payTermStatus || 'Pending'
        });
        
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating pay term:', error);
        res.status(500).json({ error: 'Failed to create pay term' });
    }
});

// Update pay term
router.put('/:id', async (req, res) => {
    try {
        const { 
            payTermName, percentageAmount, fixedAmount, dueDate, 
            payTermDescription, payTermStatus 
        } = req.body;
        
        const result = await database.query(`
            UPDATE PayTerms 
            SET PayTermName = @payTermName,
                PercentageAmount = @percentageAmount,
                FixedAmount = @fixedAmount,
                DueDate = @dueDate,
                PayTermDescription = @payTermDescription,
                PayTermStatus = @payTermStatus,
                ModifiedDate = GETDATE()
            OUTPUT INSERTED.PayTermID, INSERTED.ProjectID, INSERTED.EstimateID, 
                   INSERTED.PayTermType, INSERTED.PayTermName, INSERTED.PercentageAmount, 
                   INSERTED.FixedAmount, INSERTED.DueDate, INSERTED.PayTermDescription, 
                   INSERTED.PayTermStatus, INSERTED.CreatedDate, INSERTED.ModifiedDate
            WHERE PayTermID = @payTermId
        `, {
            payTermId: req.params.id,
            payTermName,
            percentageAmount,
            fixedAmount,
            dueDate,
            payTermDescription,
            payTermStatus
        });
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Pay term not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating pay term:', error);
        res.status(500).json({ error: 'Failed to update pay term' });
    }
});

// Delete pay term
router.delete('/:id', async (req, res) => {
    try {
        const result = await database.query(`
            DELETE FROM PayTerms WHERE PayTermID = @payTermId
        `, { payTermId: req.params.id });
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Pay term not found' });
        }
        
        res.json({ message: 'Pay term deleted successfully' });
    } catch (error) {
        console.error('Error deleting pay term:', error);
        res.status(500).json({ error: 'Failed to delete pay term' });
    }
});

// Mark pay term as paid
router.post('/:id/mark-paid', async (req, res) => {
    try {
        const { paymentDate } = req.body;
        
        const result = await database.query(`
            UPDATE PayTerms 
            SET PayTermStatus = 'Paid',
                DueDate = @paymentDate,
                ModifiedDate = GETDATE()
            OUTPUT INSERTED.PayTermID, INSERTED.ProjectID, INSERTED.EstimateID, 
                   INSERTED.PayTermType, INSERTED.PayTermName, INSERTED.PercentageAmount, 
                   INSERTED.FixedAmount, INSERTED.DueDate, INSERTED.PayTermDescription, 
                   INSERTED.PayTermStatus, INSERTED.CreatedDate, INSERTED.ModifiedDate
            WHERE PayTermID = @payTermId
        `, {
            payTermId: req.params.id,
            paymentDate: paymentDate || new Date().toISOString().split('T')[0]
        });
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Pay term not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error marking pay term as paid:', error);
        res.status(500).json({ error: 'Failed to mark pay term as paid' });
    }
});

module.exports = router;
