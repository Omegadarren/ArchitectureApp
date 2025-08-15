// routes/payments.js - FIXED VERSION
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

// Add new payment - FIXED VERSION
router.post('/', async (req, res) => {
    try {
        const { invoiceId, paymentAmount, paymentDate, paymentMethod, paymentReference } = req.body;

        console.log('Payment request received:', { invoiceId, paymentAmount, paymentDate, paymentMethod, paymentReference });

        // Validate required fields
        if (!invoiceId || !paymentAmount || !paymentDate) {
            return res.status(400).json({ error: 'Invoice ID, payment amount, and payment date are required' });
        }

        // Get current invoice details - FIXED: using correct column names
        const invoiceResult = await database.query(`
            SELECT InvoiceID, TotalAmount, PaidAmount, 
                   (TotalAmount - PaidAmount) as BalanceDue 
            FROM Invoices 
            WHERE InvoiceID = @invoiceId
        `, { invoiceId });

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.recordset[0];
        const currentBalanceDue = invoice.TotalAmount - (invoice.PaidAmount || 0);
        
        console.log('Current invoice state:', {
            totalAmount: invoice.TotalAmount,
            paidAmount: invoice.PaidAmount,
            balanceDue: currentBalanceDue
        });

        // Validate payment amount doesn't exceed balance due
        if (parseFloat(paymentAmount) > currentBalanceDue) {
            return res.status(400).json({ 
                error: `Payment amount cannot exceed balance due of $${currentBalanceDue.toFixed(2)}` 
            });
        }

        // Insert payment
        const insertResult = await database.query(`
            INSERT INTO Payments (InvoiceID, PaymentAmount, PaymentDate, PaymentMethod, PaymentReference)
            OUTPUT INSERTED.PaymentID
            VALUES (@invoiceId, @paymentAmount, @paymentDate, @paymentMethod, @paymentReference)
        `, {
            invoiceId: parseInt(invoiceId),
            paymentAmount: parseFloat(paymentAmount),
            paymentDate,
            paymentMethod: paymentMethod || 'Check',
            paymentReference: paymentReference || null
        });

        const paymentId = insertResult.recordset[0].PaymentID;
        console.log('Payment created with ID:', paymentId);

        // Update invoice totals
        const newPaidAmount = (invoice.PaidAmount || 0) + parseFloat(paymentAmount);
        const newBalanceDue = invoice.TotalAmount - newPaidAmount;

        // Determine new invoice status
        let newStatus = 'Sent';
        if (newBalanceDue <= 0.01) { // Using 0.01 to handle floating point precision
            newStatus = 'Paid';
        } else if (newPaidAmount > 0) {
            newStatus = 'Partial';
        }

        // Update invoice - FIXED: removed BalanceDue from update (it's calculated)
        await database.query(`
            UPDATE Invoices 
            SET PaidAmount = @paidAmount,
                InvoiceStatus = @status,
                ModifiedDate = GETDATE()
            WHERE InvoiceID = @invoiceId
        `, {
            invoiceId: parseInt(invoiceId),
            paidAmount: newPaidAmount,
            status: newStatus
        });

        console.log('Invoice updated successfully');

        // FIXED: using correct variable names in response
        res.status(201).json({ 
            paymentId, 
            message: 'Payment added successfully',
            newPaidAmount,  // FIXED: was newTotalPaid
            newBalanceDue,
            newStatus
        });

    } catch (error) {
        console.error('Error adding payment:', error);
        res.status(500).json({ error: 'Failed to add payment: ' + error.message });
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

// Update payment
router.put('/:id', async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        const { paymentAmount, paymentDate, paymentMethod, paymentReference } = req.body;
        
        if (isNaN(paymentId)) {
            return res.status(400).json({ error: 'Invalid payment ID' });
        }

        // Get current payment details
        const currentPaymentResult = await database.query(`
            SELECT InvoiceID, PaymentAmount FROM Payments WHERE PaymentID = @paymentId
        `, { paymentId });

        if (currentPaymentResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const currentPayment = currentPaymentResult.recordset[0];
        const amountDifference = parseFloat(paymentAmount) - currentPayment.PaymentAmount;

        // Update payment
        await database.query(`
            UPDATE Payments
            SET PaymentAmount = @paymentAmount,
                PaymentDate = @paymentDate,
                PaymentMethod = @paymentMethod,
                PaymentReference = @paymentReference
            WHERE PaymentID = @paymentId
        `, {
            paymentId,
            paymentAmount: parseFloat(paymentAmount),
            paymentDate,
            paymentMethod,
            paymentReference
        });

        // Update invoice if amount changed
        if (Math.abs(amountDifference) > 0.01) {
            const invoiceResult = await database.query(`
                SELECT TotalAmount, PaidAmount FROM Invoices WHERE InvoiceID = @invoiceId
            `, { invoiceId: currentPayment.InvoiceID });

            if (invoiceResult.recordset.length > 0) {
                const invoice = invoiceResult.recordset[0];
                const newPaidAmount = (invoice.PaidAmount || 0) + amountDifference;
                const newBalanceDue = invoice.TotalAmount - newPaidAmount;
                
                let newStatus = 'Sent';
                if (newBalanceDue <= 0.01) {
                    newStatus = 'Paid';
                } else if (newPaidAmount > 0) {
                    newStatus = 'Partial';
                }
                
                await database.query(`
                    UPDATE Invoices 
                    SET PaidAmount = @paidAmount,
                        InvoiceStatus = @status,
                        ModifiedDate = GETDATE()
                    WHERE InvoiceID = @invoiceId
                `, {
                    invoiceId: currentPayment.InvoiceID,
                    paidAmount: newPaidAmount,
                    status: newStatus
                });
            }
        }

        res.json({ message: 'Payment updated successfully' });
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({ error: 'Failed to update payment' });
    }
});

// Delete payment - FIXED VERSION
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

        // Update invoice totals - FIXED: using correct column name
        const invoiceResult = await database.query(`
            SELECT TotalAmount, PaidAmount FROM Invoices WHERE InvoiceID = @invoiceId
        `, { invoiceId: payment.InvoiceID });

        if (invoiceResult.recordset.length > 0) {
            const invoice = invoiceResult.recordset[0];
            const newPaidAmount = (invoice.PaidAmount || 0) - payment.PaymentAmount;  // FIXED: was newTotalPaid
            const newBalanceDue = invoice.TotalAmount - newPaidAmount;  // FIXED: was using undefined variable
            
            let newStatus = 'Sent';
            if (newBalanceDue <= 0.01) {
                newStatus = 'Paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'Partial';
            }
            
            // FIXED: Uncommented and corrected the update query
            await database.query(`
                UPDATE Invoices 
                SET PaidAmount = @paidAmount,
                    InvoiceStatus = @status,
                    ModifiedDate = GETDATE()
                WHERE InvoiceID = @invoiceId
            `, {
                invoiceId: payment.InvoiceID,
                paidAmount: newPaidAmount,
                status: newStatus
            });
        }

        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ error: 'Failed to delete payment' });
    }
});

// Get payments for a specific invoice
router.get('/invoice/:invoiceId', async (req, res) => {
    try {
        const invoiceId = parseInt(req.params.invoiceId);
        
        if (isNaN(invoiceId)) {
            return res.status(400).json({ error: 'Invalid invoice ID' });
        }

        const result = await database.query(`
            SELECT PaymentID, PaymentAmount, PaymentDate, PaymentMethod, PaymentReference
            FROM Payments
            WHERE InvoiceID = @invoiceId
            ORDER BY PaymentDate DESC
        `, { invoiceId });

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching invoice payments:', error);
        res.status(500).json({ error: 'Failed to fetch invoice payments' });
    }
});

// Get payment summary report
router.get('/reports/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let whereClause = 'WHERE 1=1';
        let params = {};
        
        if (startDate) {
            whereClause += ' AND p.PaymentDate >= @startDate';
            params.startDate = startDate;
        }
        
        if (endDate) {
            whereClause += ' AND p.PaymentDate <= @endDate';
            params.endDate = endDate;
        }

        const result = await database.query(`
            SELECT 
                COUNT(*) as TotalPayments,
                SUM(p.PaymentAmount) as TotalAmount,
                AVG(p.PaymentAmount) as AveragePayment,
                MIN(p.PaymentAmount) as MinPayment,
                MAX(p.PaymentAmount) as MaxPayment,
                COUNT(DISTINCT i.InvoiceID) as InvoicesPaid,
                COUNT(DISTINCT pr.CustomerID) as CustomersPayments
            FROM Payments p
            LEFT JOIN Invoices i ON p.InvoiceID = i.InvoiceID
            LEFT JOIN Projects pr ON i.ProjectID = pr.ProjectID
            ${whereClause}
        `, params);

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error generating payment summary:', error);
        res.status(500).json({ error: 'Failed to generate payment summary' });
    }
});

// Get top paying customers report
router.get('/reports/top-customers', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const result = await database.query(`
            SELECT TOP (@limit)
                c.CustomerID,
                c.CompanyName,
                c.ContactName,
                COUNT(DISTINCT p.PaymentID) as PaymentCount,
                SUM(p.PaymentAmount) as TotalPaid,
                AVG(p.PaymentAmount) as AveragePayment,
                MAX(p.PaymentDate) as LastPaymentDate
            FROM Payments p
            LEFT JOIN Invoices i ON p.InvoiceID = i.InvoiceID
            LEFT JOIN Projects pr ON i.ProjectID = pr.ProjectID
            LEFT JOIN Customers c ON pr.CustomerID = c.CustomerID
            GROUP BY c.CustomerID, c.CompanyName, c.ContactName
            ORDER BY TotalPaid DESC
        `, { limit: parseInt(limit) });

        res.json(result.recordset);
    } catch (error) {
        console.error('Error generating top customers report:', error);
        res.status(500).json({ error: 'Failed to generate top customers report' });
    }
});

module.exports = router;