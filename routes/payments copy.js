// routes/payments.js
const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Get all payments with invoice and project info
router.get('/', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT p.PaymentID, p.PaymentAmount, p.PaymentDate, p.PaymentMethod, p.PaymentReference,
                   i.InvoiceNumber, i.InvoiceID,
                   pr.ProjectName,
                   c.CompanyName
            FROM Payments p
            LEFT JOIN Invoices i ON p.InvoiceID = i.InvoiceID
            LEFT JOIN Projects pr ON i.ProjectID = pr.ProjectID
            LEFT JOIN Customers c ON pr.CustomerID = c.CustomerID
            ORDER BY p.PaymentDate DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Add new payment (THIS IS THE MISSING PART!)
router.post('/', async (req, res) => {
    try {
        const { invoiceId, paymentAmount, paymentDate, paymentMethod, paymentReference } = req.body;

        // Validate required fields
        if (!invoiceId || !paymentAmount || !paymentDate) {
            return res.status(400).json({ error: 'Invoice ID, payment amount, and payment date are required' });
        }

        // Get current invoice details
        const invoiceResult = await database.query(`
            SELECT TotalAmount, PaidAmount, BalanceDue 
            FROM Invoices 
            WHERE InvoiceID = @invoiceId
        `, { invoiceId });

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.recordset[0];
        
        // Validate payment amount doesn't exceed balance due
        if (paymentAmount > invoice.BalanceDue) {
            return res.status(400).json({ error: 'Payment amount cannot exceed balance due' });
        }

        // Insert payment
        const insertResult = await database.query(`
            INSERT INTO Payments (InvoiceID, PaymentAmount, PaymentDate, PaymentMethod, PaymentReference)
            OUTPUT INSERTED.PaymentID
            VALUES (@invoiceId, @paymentAmount, @paymentDate, @paymentMethod, @paymentReference)
        `, {
            invoiceId,
            paymentAmount,
            paymentDate,
            paymentMethod: paymentMethod || 'Check',
            paymentReference: paymentReference || null
        });

        const paymentId = insertResult.recordset[0].PaymentID;

        // Update invoice totals
        const newPaidAmount = (invoice.PaidAmount || 0) + parseFloat(paymentAmount);
        const newBalanceDue = invoice.TotalAmount - newPaidAmount;

        // Determine new invoice status
        let newStatus = 'Sent';
        if (newBalanceDue <= 0) {
            newStatus = 'Paid';
        } else if (newPaidAmount > 0) {
            newStatus = 'Partial';
        }

        // Update invoice
        await database.query(`
            UPDATE Invoices 
            SET PaidAmount = @paidAmount, 
                BalanceDue = @balanceDue,
                InvoiceStatus = @status
            WHERE InvoiceID = @invoiceId
        `, {
            invoiceId,
            paidAmount: newPaidAmount,
            balanceDue: newBalanceDue,
            status: newStatus
        });

        res.status(201).json({ 
            paymentId, 
            message: 'Payment added successfully',
            newTotalPaid,
            newBalanceDue,
            newStatus
        });

    } catch (error) {
        console.error('Error adding payment:', error);
        res.status(500).json({ error: 'Failed to add payment' });
    }
});

// Get single payment by ID
router.get('/:id', async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        
        if (isNaN(paymentId)) {
            return res.status(400).json({ error: 'Invalid payment ID' });
        }

        const result = await database.query(`
            SELECT p.PaymentID, p.PaymentAmount, p.PaymentDate, p.PaymentMethod, p.PaymentReference,
                   i.InvoiceNumber, i.InvoiceID,
                   pr.ProjectName,
                   c.CompanyName
            FROM Payments p
            LEFT JOIN Invoices i ON p.InvoiceID = i.InvoiceID
            LEFT JOIN Projects pr ON i.ProjectID = pr.ProjectID
            LEFT JOIN Customers c ON pr.CustomerID = c.CustomerID
            WHERE p.PaymentID = @paymentId
        `, { paymentId });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ error: 'Failed to fetch payment' });
    }
});

// Delete payment
router.delete('/:id', async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        
        if (isNaN(paymentId)) {
            return res.status(400).json({ error: 'Invalid payment ID' });
        }

        // Get payment details before deleting
        const paymentResult = await database.query(`
            SELECT InvoiceID, PaymentAmount FROM Payments WHERE PaymentID = @paymentId
        `, { paymentId });

        if (paymentResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const payment = paymentResult.recordset[0];

        // Delete payment
        await database.query(`
            DELETE FROM Payments WHERE PaymentID = @paymentId
        `, { paymentId });

        // Update invoice totals
        const invoiceResult = await database.query(`
            SELECT TotalAmount, TotalPaid FROM Invoices WHERE InvoiceID = @invoiceId
        `, { invoiceId: payment.InvoiceID });

        if (invoiceResult.recordset.length > 0) {
            const invoice = invoiceResult.recordset[0];
            const newPaidAmount = (invoice.PaidAmount || 0) - payment.PaymentAmount;
            const newBalanceDue = invoice.TotalAmount - newTotalPaid;
            
            let newStatus = 'Sent';
            if (newBalanceDue <= 0) {
                newStatus = 'Paid';
            } else if (newTotalPaid > 0) {
                newStatus = 'Partial';
            }
            
            // Darren commented this out due to an error
            //await database.query(`
                //UPDATE Invoices 
               //SET PaidAmount = @paidAmount, 
                    //BalanceDue = @balanceDue,
                    //InvoiceStatus = @status
                //WHERE InvoiceID = @invoiceId
            //`, {
                //invoiceId: payment.InvoiceID,
                //paidAmount: newPaidAmount,
                //balanceDue: newBalanceDue,
                //status: newStatus
            //});
        }

        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ error: 'Failed to delete payment' });
    }
});

module.exports = router;