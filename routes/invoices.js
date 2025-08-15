const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { sendEmail, testEmailConfig } = require('../config/email');
const settingsHelper = require('../utils/settingsHelper');

// Get all invoices with project and customer info
router.get('/', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.DueDate, 
                   i.SubTotal, i.TaxRate, i.TaxAmount, i.TotalAmount, i.PaidAmount, 
                   (i.TotalAmount - i.PaidAmount) as BalanceDue, i.InvoiceStatus, 
                   i.Notes, i.CreatedDate, i.ModifiedDate,
                   p.ProjectID, p.ProjectName, 
                   c.CustomerID, c.CompanyName,
                   e.EstimateID, e.EstimateNumber
            FROM Invoices i
            INNER JOIN Projects p ON i.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            LEFT JOIN Estimates e ON i.EstimateID = e.EstimateID
            ORDER BY i.CreatedDate DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

        // Replace the GET /:id route in your invoices.js with this version for frontend compatibility

        // Get single invoice by ID with line items and payments
        router.get('/:id', async (req, res) => {
            try {
                // Get invoice header
                const invoiceResult = await database.query(`
                    SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.DueDate, 
                        i.SubTotal as Subtotal, i.TaxRate, i.TaxAmount, i.TotalAmount, i.PaidAmount, 
                        (i.TotalAmount - i.PaidAmount) as BalanceDue, i.InvoiceStatus, 
                        i.Notes, i.CreatedDate, i.ModifiedDate,
                        p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState,
                        c.CustomerID, c.CompanyName, c.ContactName, c.Phone, c.Email, c.Address,
                        e.EstimateID, e.EstimateNumber
                    FROM Invoices i
                    INNER JOIN Projects p ON i.ProjectID = p.ProjectID
                    INNER JOIN Customers c ON p.CustomerID = c.CustomerID
                    LEFT JOIN Estimates e ON i.EstimateID = e.EstimateID
                    WHERE i.InvoiceID = @invoiceId
                `, { invoiceId: req.params.id });
                
                if (invoiceResult.recordset.length === 0) {
                    return res.status(404).json({ error: 'Invoice not found' });
                }
                
                // Get invoice line items
                const lineItemsResult = await database.query(`
                    SELECT ili.InvoiceLineItemID, ili.Quantity, ili.UnitRate, 
                        ili.LineTotal, ili.ItemDescription, ili.SortOrder,
                        lm.LineItemID, lm.ItemCode, lm.ItemName, lm.Category, lm.UnitOfMeasure
                    FROM InvoiceLineItems ili
                    LEFT JOIN LineItemsMaster lm ON ili.LineItemID = lm.LineItemID
                    WHERE ili.InvoiceID = @invoiceId
                    ORDER BY ili.SortOrder, ili.InvoiceLineItemID
                `, { invoiceId: req.params.id });
                
                // Get payments
                const paymentsResult = await database.query(`
                    SELECT PaymentID, PaymentDate, PaymentAmount, PaymentMethod, 
                        PaymentReference, Notes, CreatedDate
                    FROM Payments 
                    WHERE InvoiceID = @invoiceId
                    ORDER BY PaymentDate DESC
                `, { invoiceId: req.params.id });
                
                const invoice = invoiceResult.recordset[0];
                
                // Frontend expects these property names (capitalized)
                invoice.LineItems = lineItemsResult.recordset;
                invoice.Payments = paymentsResult.recordset;
                invoice.TotalPaid = invoice.PaidAmount; // Frontend alias
                
                res.json(invoice);
            } catch (error) {
                console.error('Error fetching invoice:', error);
                res.status(500).json({ error: 'Failed to fetch invoice' });
            }
        });

        // Also add this route for the line items dropdown that your frontend expects
        router.get('/line-items', async (req, res) => {
            try {
                const result = await database.query(`
                    SELECT LineItemID, ItemCode, ItemName as ItemName, 
                        ItemName as ItemDescription, StandardRate, Category,
                        UnitOfMeasure
                    FROM LineItemsMaster
                    ORDER BY Category, ItemName
                `);
                res.json(result.recordset);
            } catch (error) {
                console.error('Error fetching line items:', error);
                res.status(500).json({ error: 'Failed to fetch line items' });
            }
        });

// Create new invoice
router.post('/', async (req, res) => {
    try {
        const { 
            projectId, estimateId, invoiceNumber, invoiceDate, dueDate, 
            taxRate, invoiceStatus, notes, lineItems, payTermIds 
        } = req.body;
        
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        
        let finalLineItems = lineItems;
        
        // If payTermIds are provided, convert pay terms to line items
        if (payTermIds && payTermIds.length > 0) {
            const payTermsResult = await database.query(`
                SELECT pt.PayTermID, pt.PayTermName, pt.FixedAmount, pt.PercentageAmount, 
                       pt.PayTermDescription, p.ProjectName, e.TotalAmount as EstimateTotal
                FROM PayTerms pt
                INNER JOIN Projects p ON pt.ProjectID = p.ProjectID
                LEFT JOIN Estimates e ON pt.EstimateID = e.EstimateID
                WHERE pt.PayTermID IN (${payTermIds.map((_, i) => `@payTermId${i}`).join(',')})
            `, payTermIds.reduce((params, id, i) => {
                params[`payTermId${i}`] = id;
                return params;
            }, {}));
            
            finalLineItems = payTermsResult.recordset.map(payTerm => {
                let unitRate = 0;
                
                if (payTerm.PercentageAmount) {
                    // For percentage-based pay terms: calculate actual amount
                    unitRate = (payTerm.EstimateTotal || 0) * (payTerm.PercentageAmount / 100);
                } else {
                    // For fixed amount pay terms: use the fixed amount
                    unitRate = payTerm.FixedAmount || 0;
                }
                
                return {
                    itemDescription: payTerm.PayTermName || 'Payment',
                    quantity: 1,
                    unitRate: unitRate
                };
            });
        }
        
        if (!finalLineItems || finalLineItems.length === 0) {
            return res.status(400).json({ error: 'At least one line item or pay term is required' });
        }
        
        // Generate invoice number if not provided
        let finalInvoiceNumber = invoiceNumber;
        if (!finalInvoiceNumber) {
            const numberResult = await database.query(`
                SELECT 'INV-' + FORMAT(ISNULL(MAX(CAST(SUBSTRING(InvoiceNumber, 5, LEN(InvoiceNumber)) AS INT)), 0) + 1, '0000') as InvoiceNumber
                FROM Invoices 
                WHERE InvoiceNumber LIKE 'INV-%'
            `);
            finalInvoiceNumber = numberResult.recordset[0].InvoiceNumber;
        }
        
        // Calculate totals
        let subTotal = 0;
        finalLineItems.forEach(item => {
            subTotal += (item.quantity || 1) * (item.unitRate || 0);
        });
        
        const finalTaxRate = taxRate || 0; // Default to no tax
        const taxAmount = subTotal * finalTaxRate;
        const totalAmount = subTotal + taxAmount;
        
        // Create invoice
        const invoiceResult = await database.query(`
            INSERT INTO Invoices (ProjectID, EstimateID, InvoiceNumber, InvoiceDate, DueDate, 
                                SubTotal, TaxRate, TaxAmount, TotalAmount, InvoiceStatus, Notes)
            OUTPUT INSERTED.InvoiceID, INSERTED.ProjectID, INSERTED.EstimateID, INSERTED.InvoiceNumber, 
                   INSERTED.InvoiceDate, INSERTED.DueDate, INSERTED.SubTotal, 
                   INSERTED.TaxRate, INSERTED.TaxAmount, INSERTED.TotalAmount, INSERTED.PaidAmount,
                   INSERTED.InvoiceStatus, INSERTED.Notes, INSERTED.CreatedDate, INSERTED.ModifiedDate
            VALUES (@projectId, @estimateId, @invoiceNumber, @invoiceDate, @dueDate, 
                    @subTotal, @taxRate, @taxAmount, @totalAmount, @invoiceStatus, @notes)
        `, {
            projectId,
            estimateId: estimateId || null,
            invoiceNumber: finalInvoiceNumber,
            invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
            dueDate: dueDate || null,
            subTotal,
            taxRate: finalTaxRate,
            taxAmount,
            totalAmount,
            invoiceStatus: invoiceStatus || 'Sent',
            notes: notes || null
        });
        
        const invoiceId = invoiceResult.recordset[0].InvoiceID;
        
// Add line items
for (let i = 0; i < finalLineItems.length; i++) {
    const item = finalLineItems[i];
    const lineTotal = (item.quantity || 1) * (item.unitRate || 0); // CALCULATE LINE TOTAL
    await database.query(`
        INSERT INTO InvoiceLineItems (InvoiceID, LineItemID, Quantity, UnitRate, ItemDescription, SortOrder)
        VALUES (@invoiceId, @lineItemId, @quantity, @unitRate, @itemDescription, @sortOrder)
    `, {
        invoiceId,
        lineItemId: item.lineItemId || null,
        quantity: item.quantity || 1,
        unitRate: item.unitRate || 0,
        itemDescription: item.itemDescription,
        sortOrder: i
    });
}
        
        res.status(201).json(invoiceResult.recordset[0]);
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

// Update invoice
router.put('/:id', async (req, res) => {
    try {
        const { 
            invoiceDate, dueDate, taxRate, 
            invoiceStatus, notes, lineItems 
        } = req.body;
        
        if (!lineItems || lineItems.length === 0) {
            return res.status(400).json({ error: 'At least one line item is required' });
        }
        
        // Calculate totals
        let subTotal = 0;
        lineItems.forEach(item => {
            subTotal += (item.quantity || 1) * (item.unitRate || 0);
        });
        
        const finalTaxRate = taxRate || 0.0875;
        const taxAmount = subTotal * finalTaxRate;
        const totalAmount = subTotal + taxAmount;
        
        // Update invoice header
        const invoiceResult = await database.query(`
            UPDATE Invoices 
            SET InvoiceDate = @invoiceDate, 
                DueDate = @dueDate, 
                SubTotal = @subTotal, 
                TaxRate = @taxRate, 
                TaxAmount = @taxAmount, 
                TotalAmount = @totalAmount, 
                InvoiceStatus = @invoiceStatus, 
                Notes = @notes,
                ModifiedDate = GETDATE()
            OUTPUT INSERTED.InvoiceID, INSERTED.ProjectID, INSERTED.EstimateID, INSERTED.InvoiceNumber, 
                   INSERTED.InvoiceDate, INSERTED.DueDate, INSERTED.SubTotal, 
                   INSERTED.TaxRate, INSERTED.TaxAmount, INSERTED.TotalAmount, INSERTED.PaidAmount,
                   INSERTED.InvoiceStatus, INSERTED.Notes, INSERTED.CreatedDate, INSERTED.ModifiedDate
            WHERE InvoiceID = @invoiceId
        `, {
            invoiceId: req.params.id,
            invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
            dueDate: dueDate || null,
            subTotal,
            taxRate: finalTaxRate,
            taxAmount,
            totalAmount,
            invoiceStatus: invoiceStatus || 'Sent',
            notes: notes || null
        });
        
        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        // Delete existing line items
        await database.query(`
            DELETE FROM InvoiceLineItems WHERE InvoiceID = @invoiceId
        `, { invoiceId: req.params.id });
        
        // Add updated line items
        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i];
            const lineTotal = (item.quantity || 1) * (item.unitRate || 0); // CALCULATE LINE TOTAL
            await database.query(`
                INSERT INTO InvoiceLineItems (InvoiceID, LineItemID, Quantity, UnitRate, ItemDescription, SortOrder)
                VALUES (@invoiceId, @lineItemId, @quantity, @unitRate, @itemDescription, @sortOrder)
            `, {
                invoiceId: req.params.id,
                lineItemId: item.lineItemId || null,
                quantity: item.quantity || 1,
                unitRate: item.unitRate || 0,
                itemDescription: item.itemDescription,
                sortOrder: i
            });
        }
        
        res.json(invoiceResult.recordset[0]);
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ error: 'Failed to update invoice' });
    }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
    try {
        // Check if invoice has payments
        const paymentCheck = await database.query(`
            SELECT COUNT(*) as paymentCount FROM Payments WHERE InvoiceID = @invoiceId
        `, { invoiceId: req.params.id });
        
        if (paymentCheck.recordset[0].paymentCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete invoice with payments. Delete payments first.' 
            });
        }
        
        // Delete line items first
        await database.query(`
            DELETE FROM InvoiceLineItems WHERE InvoiceID = @invoiceId
        `, { invoiceId: req.params.id });
        
        // Delete invoice
        const result = await database.query(`
            DELETE FROM Invoices WHERE InvoiceID = @invoiceId
        `, { invoiceId: req.params.id });
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({ error: 'Failed to delete invoice' });
    }
});

// Add payment to invoice
router.post('/:id/payments', async (req, res) => {
    try {
        const { paymentDate, paymentAmount, paymentMethod, paymentReference, notes } = req.body;
        
        if (!paymentAmount || paymentAmount <= 0) {
            return res.status(400).json({ error: 'Valid payment amount is required' });
        }
        
        // Get current invoice details
        const invoiceResult = await database.query(`
            SELECT TotalAmount, PaidAmount FROM Invoices WHERE InvoiceID = @invoiceId
        `, { invoiceId: req.params.id });
        
        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        const invoice = invoiceResult.recordset[0];
        const currentBalance = invoice.TotalAmount - invoice.PaidAmount;
        
        if (paymentAmount > currentBalance) {
            return res.status(400).json({ 
                error: `Payment amount cannot exceed balance due of $${currentBalance.toFixed(2)}` 
            });
        }
        
        // Add payment
        const paymentResult = await database.query(`
            INSERT INTO Payments (InvoiceID, PaymentDate, PaymentAmount, PaymentMethod, PaymentReference, Notes)
            OUTPUT INSERTED.PaymentID, INSERTED.InvoiceID, INSERTED.PaymentDate, 
                   INSERTED.PaymentAmount, INSERTED.PaymentMethod, INSERTED.PaymentReference, 
                   INSERTED.Notes, INSERTED.CreatedDate
            VALUES (@invoiceId, @paymentDate, @paymentAmount, @paymentMethod, @paymentReference, @notes)
        `, {
            invoiceId: req.params.id,
            paymentDate: paymentDate || new Date().toISOString().split('T')[0],
            paymentAmount,
            paymentMethod: paymentMethod || null,
            paymentReference: paymentReference || null,
            notes: notes || null
        });
        
        // Update invoice paid amount
        const newPaidAmount = invoice.PaidAmount + paymentAmount;
        const newStatus = newPaidAmount >= invoice.TotalAmount ? 'Paid' : 'Partial';
        
        await database.query(`
            UPDATE Invoices 
            SET PaidAmount = @paidAmount,
                InvoiceStatus = @invoiceStatus,
                ModifiedDate = GETDATE()
            WHERE InvoiceID = @invoiceId
        `, {
            invoiceId: req.params.id,
            paidAmount: newPaidAmount,
            invoiceStatus: newStatus
        });
        
        res.status(201).json(paymentResult.recordset[0]);
    } catch (error) {
        console.error('Error adding payment:', error);
        res.status(500).json({ error: 'Failed to add payment' });
    }
});

// Get overdue invoices
router.get('/reports/overdue', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.DueDate, 
                   i.TotalAmount, i.PaidAmount, (i.TotalAmount - i.PaidAmount) as BalanceDue,
                   DATEDIFF(day, i.DueDate, GETDATE()) as DaysOverdue,
                   p.ProjectName, c.CompanyName, c.ContactName, c.Phone, c.Email
            FROM Invoices i
            INNER JOIN Projects p ON i.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE i.DueDate < GETDATE() 
              AND (i.TotalAmount - i.PaidAmount) > 0
              AND i.InvoiceStatus NOT IN ('Paid', 'Cancelled')
            ORDER BY i.DueDate ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching overdue invoices:', error);
        res.status(500).json({ error: 'Failed to fetch overdue invoices' });
    }
});

// Get invoice aging report
router.get('/reports/aging', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT 
                c.CompanyName,
                c.ContactName,
                c.Phone,
                c.Email,
                SUM(CASE WHEN DATEDIFF(day, i.DueDate, GETDATE()) <= 0 THEN (i.TotalAmount - i.PaidAmount) ELSE 0 END) as Current,
                SUM(CASE WHEN DATEDIFF(day, i.DueDate, GETDATE()) BETWEEN 1 AND 30 THEN (i.TotalAmount - i.PaidAmount) ELSE 0 END) as Days1to30,
                SUM(CASE WHEN DATEDIFF(day, i.DueDate, GETDATE()) BETWEEN 31 AND 60 THEN (i.TotalAmount - i.PaidAmount) ELSE 0 END) as Days31to60,
                SUM(CASE WHEN DATEDIFF(day, i.DueDate, GETDATE()) BETWEEN 61 AND 90 THEN (i.TotalAmount - i.PaidAmount) ELSE 0 END) as Days61to90,
                SUM(CASE WHEN DATEDIFF(day, i.DueDate, GETDATE()) > 90 THEN (i.TotalAmount - i.PaidAmount) ELSE 0 END) as Over90Days,
                SUM(i.TotalAmount - i.PaidAmount) as TotalOutstanding
            FROM Invoices i
            INNER JOIN Projects p ON i.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE (i.TotalAmount - i.PaidAmount) > 0
              AND i.InvoiceStatus NOT IN ('Paid', 'Cancelled')
            GROUP BY c.CustomerID, c.CompanyName, c.ContactName, c.Phone, c.Email
            ORDER BY TotalOutstanding DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error generating aging report:', error);
        res.status(500).json({ error: 'Failed to generate aging report' });
    }
});

// Get invoice summary by date range
router.get('/reports/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let whereClause = 'WHERE 1=1';
        let params = {};
        
        if (startDate) {
            whereClause += ' AND i.InvoiceDate >= @startDate';
            params.startDate = startDate;
        }
        
        if (endDate) {
            whereClause += ' AND i.InvoiceDate <= @endDate';
            params.endDate = endDate;
        }
        
        const result = await database.query(`
            SELECT 
                COUNT(*) as TotalInvoices,
                SUM(i.TotalAmount) as TotalInvoiced,
                SUM(i.PaidAmount) as TotalPaid,
                SUM(i.TotalAmount - i.PaidAmount) as TotalOutstanding,
                AVG(i.TotalAmount) as AverageInvoiceAmount,
                COUNT(CASE WHEN i.InvoiceStatus = 'Paid' THEN 1 END) as PaidInvoices,
                COUNT(CASE WHEN i.InvoiceStatus = 'Partial' THEN 1 END) as PartialInvoices,
                COUNT(CASE WHEN i.InvoiceStatus = 'Sent' THEN 1 END) as UnpaidInvoices,
                COUNT(CASE WHEN i.DueDate < GETDATE() AND (i.TotalAmount - i.PaidAmount) > 0 THEN 1 END) as OverdueInvoices
            FROM Invoices i
            INNER JOIN Projects p ON i.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            ${whereClause}
        `, params);
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error generating invoice summary:', error);
        res.status(500).json({ error: 'Failed to generate invoice summary' });
    }
});

// Get monthly invoice trends
router.get('/reports/trends', async (req, res) => {
    try {
        const { year } = req.query;
        const targetYear = year || new Date().getFullYear();
        
        const result = await database.query(`
            SELECT 
                MONTH(i.InvoiceDate) as Month,
                DATENAME(month, i.InvoiceDate) as MonthName,
                COUNT(*) as InvoiceCount,
                SUM(i.TotalAmount) as TotalInvoiced,
                SUM(i.PaidAmount) as TotalPaid,
                AVG(i.TotalAmount) as AverageInvoiceAmount
            FROM Invoices i
            WHERE YEAR(i.InvoiceDate) = @year
            GROUP BY MONTH(i.InvoiceDate), DATENAME(month, i.InvoiceDate)
            ORDER BY MONTH(i.InvoiceDate)
        `, { year: targetYear });
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error generating invoice trends:', error);
        res.status(500).json({ error: 'Failed to generate invoice trends' });
    }
});

// Test email configuration
router.get('/test-email', async (req, res) => {
    try {
        const result = await testEmailConfig();
        res.json(result);
    } catch (error) {
        console.error('Error testing email config:', error);
        res.status(500).json({ error: 'Failed to test email configuration: ' + error.message });
    }
});

// Mark invoice as sent
router.post('/:id/send', async (req, res) => {
    try {
        const invoiceId = req.params.id;
        console.log(`📧 Email invoice route called for invoice ID: ${invoiceId}`);
        
        // Get invoice with full details including customer email
        const invoiceResult = await database.query(`
            SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.DueDate, 
                   i.SubTotal, i.TaxRate, i.TaxAmount, i.TotalAmount, i.PaidAmount, 
                   (i.TotalAmount - i.PaidAmount) as BalanceDue, i.InvoiceStatus, 
                   i.Notes, i.CreatedDate, i.ModifiedDate,
                   p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip,
                   c.CustomerID, c.CompanyName, c.ContactName, c.Phone, c.Email, c.Address, 
                   c.City, c.State, c.ZipCode
            FROM Invoices i
            INNER JOIN Projects p ON i.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE i.InvoiceID = @invoiceId
        `, { invoiceId });
        
        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        const invoice = invoiceResult.recordset[0];
        const customerEmail = invoice.Email;
        
        if (!customerEmail) {
            return res.status(400).json({ error: 'Customer email not found. Please add an email address to the customer record.' });
        }
        
        // Get invoice line items
        const lineItemsResult = await database.query(`
            SELECT ili.InvoiceLineItemID, ili.Quantity, ili.UnitRate, 
                ili.LineTotal, ili.ItemDescription, ili.SortOrder,
                lm.LineItemID, lm.ItemCode, lm.ItemName, lm.Category, lm.UnitOfMeasure
            FROM InvoiceLineItems ili
            LEFT JOIN LineItemsMaster lm ON ili.LineItemID = lm.LineItemID
            WHERE ili.InvoiceID = @invoiceId
            ORDER BY ili.SortOrder, ili.InvoiceLineItemID
        `, { invoiceId });

        invoice.lineItems = lineItemsResult.recordset;
        
        console.log(`📧 Preparing to email invoice ${invoice.InvoiceNumber} to ${customerEmail}`);
        
        // Generate invoice HTML for email
        const invoiceHtml = await generateInvoiceEmailHTML(invoice);
        
        // Get settings for email subject
        const settings = await settingsHelper.getSettings();
        
        // Send actual email
        const emailResult = await sendEmail(
            customerEmail,
            `Invoice ${invoice.InvoiceNumber} from ${settings.company_name}`,
            invoiceHtml
        );
        
        if (!emailResult.success) {
            console.error('❌ Failed to send email:', emailResult.error);
            return res.status(500).json({ 
                error: 'Failed to send email: ' + emailResult.error 
            });
        }
        
        // Update invoice status to 'Sent'
        await database.query(`
            UPDATE Invoices 
            SET InvoiceStatus = 'Sent', 
                ModifiedDate = GETDATE()
            WHERE InvoiceID = @invoiceId
        `, { invoiceId });
        
        console.log(`✅ Invoice ${invoice.InvoiceNumber} successfully emailed to ${customerEmail}`);
        console.log(`📧 Message ID: ${emailResult.messageId}`);
        console.log(`📋 Invoice details: Total: $${invoice.TotalAmount}, Customer: ${invoice.CompanyName}`);
        
        res.json({ 
            success: true, 
            message: `Invoice ${invoice.InvoiceNumber} has been marked as sent to ${customerEmail}`,
            invoiceNumber: invoice.InvoiceNumber,
            customerEmail: customerEmail,
            invoice: {
                InvoiceID: invoice.InvoiceID,
                InvoiceNumber: invoice.InvoiceNumber,
                InvoiceStatus: 'Sent',
                TotalAmount: invoice.TotalAmount,
                CompanyName: invoice.CompanyName
            }
        });
        
    } catch (error) {
        console.error('Error sending invoice email:', error);
        res.status(500).json({ error: 'Failed to send invoice email: ' + error.message });
    }
});

// Generate invoice PDF using PDFKit
router.get('/:id/pdf', async (req, res) => {
    try {
        const invoiceId = req.params.id;
        console.log(`📄 PDF route called for invoice ID: ${invoiceId}`);
        
        // Get invoice with full details
        const invoiceResult = await database.query(`
            SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.DueDate, 
                   i.SubTotal, i.TaxRate, i.TaxAmount, i.TotalAmount, i.PaidAmount, 
                   (i.TotalAmount - i.PaidAmount) as BalanceDue, i.InvoiceStatus, 
                   i.Notes, i.CreatedDate, i.ModifiedDate,
                   p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip,
                   c.CustomerID, c.CompanyName, c.ContactName, c.Phone, c.Email, c.Address, 
                   c.City, c.State, c.ZipCode
            FROM Invoices i
            INNER JOIN Projects p ON i.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE i.InvoiceID = @invoiceId
        `, { invoiceId: req.params.id });
        
        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        
        // Get line items
        const lineItemsResult = await database.query(`
            SELECT ili.Quantity, ili.UnitRate, ili.ItemDescription,
                   lm.ItemCode, lm.ItemName, lm.UnitOfMeasure
            FROM InvoiceLineItems ili
            LEFT JOIN LineItemsMaster lm ON ili.LineItemID = lm.LineItemID
            WHERE ili.InvoiceID = @invoiceId
            ORDER BY ili.SortOrder, ili.InvoiceLineItemID
        `, { invoiceId: req.params.id });
        
        const invoice = invoiceResult.recordset[0];
        invoice.lineItems = lineItemsResult.recordset;
        
        // Generate PDF using PDFKit
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'LETTER',
            info: {
                Title: `Invoice ${invoice.InvoiceNumber}`,
                Author: 'Omega Builders, LLC',
                Subject: `Invoice for ${invoice.ProjectName}`,
                Creator: 'Omega Builders Invoice System'
            }
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.InvoiceNumber}.pdf"`);
        
        // Pipe PDF to response
        doc.pipe(res);
        
        // Professional color scheme
        const brandBlue = '#1e3d59';
        const accentBlue = '#17a2b8';
        const darkGray = '#495057';
        const lightGray = '#f8f9fa';
        const mediumGray = '#dee2e6';
        const success = '#28a745';
        const danger = '#dc3545';
        
        // ===== HEADER SECTION =====
        // Top border accent
        doc.rect(50, 50, doc.page.width - 100, 2)
           .fillColor(brandBlue).fill();
        
        // Company name - smaller
        doc.fontSize(16).font('Helvetica-Bold')
           .fillColor(brandBlue)
           .text('OMEGA BUILDERS, LLC', 50, 60);
        
        // Company tagline
        doc.fontSize(8).font('Helvetica')
           .fillColor(darkGray)
           .text('Professional Design Services', 50, 78);
        
        // INVOICE header (top right) - smaller
        doc.fontSize(18).font('Helvetica-Bold')
           .fillColor(brandBlue)
           .text('INVOICE', 440, 60);
        
        // Invoice number with background - smaller
        const invNumWidth = doc.widthOfString(`#${invoice.InvoiceNumber}`) + 12;
        doc.rect(440, 80, invNumWidth, 16)
           .fillColor(accentBlue).fill();
        
        doc.fontSize(10).font('Helvetica-Bold')
           .fillColor('white')
           .text(`#${invoice.InvoiceNumber}`, 446, 85);
        
        // ===== INVOICE DETAILS SECTION =====
        const detailsStartY = 110;
        
        // Details box with shadow effect - smaller
        doc.rect(370, detailsStartY - 2, 185, 50)
           .fillColor('#e9ecef').fill();
        doc.rect(372, detailsStartY, 181, 46)
           .fillColor('white').fill()
           .strokeColor(mediumGray).stroke();
        
        // Invoice details - smaller fonts
        doc.fontSize(7).font('Helvetica-Bold')
           .fillColor(darkGray)
           .text('INVOICE DATE', 378, detailsStartY + 6);
        doc.fontSize(8).font('Helvetica')
           .fillColor('black')
           .text(new Date(invoice.InvoiceDate).toLocaleDateString(), 378, detailsStartY + 16);
        
        if (invoice.DueDate) {
            doc.fontSize(7).font('Helvetica-Bold')
               .fillColor(darkGray)
               .text('DUE DATE', 460, detailsStartY + 6);
            doc.fontSize(8).font('Helvetica')
               .fillColor('black')
               .text('Due now', 460, detailsStartY + 16);
        }
        
        doc.fontSize(7).font('Helvetica-Bold')
           .fillColor(darkGray)
           .text('STATUS', 378, detailsStartY + 28);
        doc.fontSize(8).font('Helvetica')
           .fillColor(invoice.InvoiceStatus === 'Paid' ? success : (invoice.PaidAmount > 0 ? '#fd7e14' : danger))
           .text(invoice.InvoiceStatus || 'Unpaid', 378, detailsStartY + 38);
        
        // ===== CUSTOMER INFORMATION =====
        const customerY = 110;
        
        doc.fontSize(9).font('Helvetica-Bold')
           .fillColor(brandBlue)
           .text('BILL TO', 50, customerY);
        
        // Customer box - smaller
        doc.rect(50, customerY + 12, 300, 60)
           .strokeColor(mediumGray).lineWidth(1).stroke();
        
        let custY = customerY + 20;
        // Company name - smaller
        doc.fontSize(10).font('Helvetica-Bold')
           .fillColor('black')
           .text(invoice.CompanyName || 'N/A', 58, custY);
        custY += 12;
        
        if (invoice.ContactName) {
            doc.fontSize(8).font('Helvetica')
               .fillColor(darkGray)
               .text(invoice.ContactName, 58, custY);
            custY += 10;
        }
        
        if (invoice.Address) {
            doc.fontSize(8).font('Helvetica')
               .fillColor(darkGray)
               .text(invoice.Address, 58, custY);
            custY += 10;
        }
        
        const cityStateZip = [invoice.City, invoice.State, invoice.ZipCode]
            .filter(Boolean).join(', ');
        if (cityStateZip) {
            doc.fontSize(8).font('Helvetica')
               .fillColor(darkGray)
               .text(cityStateZip, 58, custY);
            custY += 10;
        }
        
        // ===== PROJECT INFORMATION =====
        const projectY = 170; // Moved up since we removed phone
        
        // Project box - smaller (removed "PROJECT DETAILS" text)
        doc.rect(50, projectY, 500, 28) // Reduced height, moved up since no label
           .fillColor(lightGray).fill()
           .strokeColor(mediumGray).lineWidth(1).stroke();
        
        doc.fontSize(8).font('Helvetica-Bold') // Smaller font
           .fillColor('black')
           .text(invoice.ProjectName || 'N/A', 58, projectY + 6);
        
        if (invoice.ProjectAddress) {
            const projectLocation = [
                invoice.ProjectAddress,
                [invoice.ProjectCity, invoice.ProjectState, invoice.ProjectZip].filter(Boolean).join(', ')
            ].filter(Boolean).join(', ');
            
            doc.fontSize(7).font('Helvetica') // Smaller font
               .fillColor(darkGray)
               .text(projectLocation, 58, projectY + 18); // Moved up
        }
        
        // ===== LINE ITEMS TABLE =====
        const tableY = 200; // Moved up more since we removed the label
        
        // Table header with gradient effect - smaller
        doc.rect(50, tableY, 500, 20)
           .fillColor(brandBlue).fill();
        
        // Header text - smaller - adjusted column positions
        doc.fontSize(8).font('Helvetica-Bold')
           .fillColor('white')
           .text('DESCRIPTION', 58, tableY + 6)
           .text('QTY', 340, tableY + 6)
           .text('RATE', 390, tableY + 6)
           .text('TOTAL', 460, tableY + 6, { align: 'right', width: 80 });
        
        let itemY = tableY + 26;
        let runningTotal = 0;
        
        // Line items with alternating colors - smaller text
        if (invoice.lineItems && invoice.lineItems.length > 0) {
            invoice.lineItems.forEach((item, index) => {
                const quantity = parseFloat(item.Quantity || 1);
                const unitRate = parseFloat(item.UnitRate || 0);
                const lineTotal = quantity * unitRate; // Calculate directly, don't use database value
                runningTotal += lineTotal;
                
                // Alternating row background - smaller rows
                if (index % 2 === 0) {
                    doc.rect(50, itemY - 3, 500, 16)
                       .fillColor('#f8f9fa').fill();
                }
                
                // Left border for each row
                doc.rect(50, itemY - 3, 2, 16)
                   .fillColor(accentBlue).fill();
                
                // Render each column separately to avoid any chaining issues
                doc.fontSize(8).font('Helvetica').fillColor('black');
                doc.text(item.ItemDescription || item.ItemName || 'Professional Services', 58, itemY, { width: 270, ellipsis: true });
                doc.text(quantity.toString(), 340, itemY, { align: 'center', width: 30 });
                doc.text(`$${unitRate.toFixed(2)}`, 390, itemY, { align: 'right', width: 60 });
                doc.text(`$${lineTotal.toFixed(2)}`, 460, itemY, { align: 'right', width: 80 });
                
                itemY += 16;
            });
        } else {
            // Default line item - smaller
            doc.rect(50, itemY - 4, 500, 20)
               .fillColor('#f8f9fa').fill();
            doc.rect(50, itemY - 4, 2, 20)
               .fillColor(accentBlue).fill();
            
            const totalAmount = parseFloat(invoice.TotalAmount || 0);
            runningTotal = totalAmount;
            
            // Render each field separately for the default line item
            doc.fontSize(9).font('Helvetica').fillColor('black');
            doc.text('Professional Services', 60, itemY, { width: 270 });
            doc.text('1', 340, itemY, { align: 'center' });
            doc.text(`$${totalAmount.toFixed(2)}`, 390, itemY, { align: 'right' });
            doc.text(`$${totalAmount.toFixed(2)}`, 460, itemY, { align: 'right', width: 80 });
            itemY += 20;
        }
        
        // Table bottom border - smaller
        doc.rect(50, itemY + 3, 500, 2)
           .fillColor(brandBlue).fill();
        
        // ===== TOTALS SECTION =====
        const totalsY = itemY + 15;
        const totalsX = 370;
        
        // Totals box - smaller
        doc.rect(totalsX, totalsY, 180, 70)
           .strokeColor(mediumGray).lineWidth(1).stroke();
        
        // Subtotal - smaller
        doc.fontSize(8).font('Helvetica')
           .fillColor('black')
           .text('Subtotal', totalsX + 10, totalsY + 8)
           .text(`$${parseFloat(invoice.SubTotal || runningTotal).toFixed(2)}`, totalsX + 10, totalsY + 8, { align: 'right', width: 160 });
        
        let currentTotalY = totalsY + 20;
        
        // Tax - smaller
        if (invoice.TaxRate && invoice.TaxRate > 0) {
            doc.text(`Tax (${(parseFloat(invoice.TaxRate) * 100).toFixed(1)}%)`, totalsX + 10, currentTotalY)
               .text(`$${parseFloat(invoice.TaxAmount || 0).toFixed(2)}`, totalsX + 10, currentTotalY, { align: 'right', width: 160 });
            currentTotalY += 12;
        }
        
        // Separator line
        doc.moveTo(totalsX + 10, currentTotalY + 2)
           .lineTo(totalsX + 170, currentTotalY + 2)
           .strokeColor(mediumGray).stroke();
        
        // Total amount - highlighted but smaller
        doc.rect(totalsX + 5, currentTotalY + 4, 170, 18)
           .fillColor(brandBlue).fill();
        
        doc.fontSize(10).font('Helvetica-Bold')
           .fillColor('white')
           .text('TOTAL', totalsX + 10, currentTotalY + 9)
           .text(`$${parseFloat(invoice.TotalAmount || 0).toFixed(2)}`, totalsX + 10, currentTotalY + 9, { align: 'right', width: 160 });
        
        // Balance due (if different from total) - smaller
        if (invoice.PaidAmount && invoice.PaidAmount > 0) {
            currentTotalY += 28;
            
            doc.fontSize(8).font('Helvetica')
               .fillColor('black')
               .text('Amount Paid', totalsX + 10, currentTotalY)
               .text(`-$${parseFloat(invoice.PaidAmount).toFixed(2)}`, totalsX + 10, currentTotalY, { align: 'right', width: 160 });
            
            currentTotalY += 14;
            
            // Balance due - highlighted in red if unpaid but smaller
            doc.rect(totalsX + 5, currentTotalY, 170, 16)
               .fillColor(danger).fillOpacity(0.1).fill();
            
            doc.fontSize(9).font('Helvetica-Bold')
               .fillColor(danger)
               .text('BALANCE DUE', totalsX + 10, currentTotalY + 4)
               .text(`$${parseFloat(invoice.BalanceDue || 0).toFixed(2)}`, totalsX + 10, currentTotalY + 4, { align: 'right', width: 160 });
        }
        
        // ===== FOOTER SECTION =====
        // Position footer based on content, not fixed from bottom
        let footerY = Math.max(currentTotalY + 40, 400); // At least 40px after totals, but not before line 400
        
        // Payment terms section - bigger text
        doc.rect(50, footerY - 8, 500, 30) // Slightly taller for bigger text
           .fillColor(lightGray).fill()
           .strokeColor(mediumGray).stroke();
        
        doc.fontSize(9).font('Helvetica-Bold') // Bigger
           .fillColor(brandBlue)
           .text('PAYMENT TERMS', 60, footerY); 
        
        doc.fontSize(8).font('Helvetica') // Bigger
           .fillColor('black')
           .text('Payment is due immediately upon receipt of this invoice. Thank you for your business!', 60, footerY + 12);
        
        // Payment methods section
        const paymentMethodsY = footerY + 30;
        const totalAmount = parseFloat(invoice.TotalAmount || 0);
        const venmoAmount = totalAmount * 1.0175; // 1.75% fee
        const cardAmount = totalAmount * 1.03; // 3% fee
        
        console.log(`💳 Adding payment methods section - Total: $${totalAmount.toFixed(2)}, Venmo: $${venmoAmount.toFixed(2)}, Card: $${cardAmount.toFixed(2)}`);
        
        doc.rect(50, paymentMethodsY - 8, 500, 65) // Taller box for payment methods
           .fillColor(lightGray).fill()
           .strokeColor(mediumGray).stroke();
        
        doc.fontSize(9).font('Helvetica-Bold')
           .fillColor(brandBlue)
           .text('PAYMENT METHODS', 60, paymentMethodsY);
        
        // Check or Zelle (No Fees)
        doc.fontSize(8).font('Helvetica-Bold')
           .fillColor('black')
           .text(`Check or Zelle: (No Fees) $${totalAmount.toFixed(2)} (Zelle service provided by your bank)`, 60, paymentMethodsY + 14);
        doc.fontSize(7).font('Helvetica')
           .fillColor('black')
           .text('Zelle ID: darren@omega-builders.com, Check: Mail to the address above', 60, paymentMethodsY + 26);
        
        // Venmo (1.75% Fee)
        doc.fontSize(8).font('Helvetica-Bold')
           .fillColor('black')
           .text(`Venmo: $${venmoAmount.toFixed(2)} (1.75% Fee) Venmo ID: @Darren-Anderson-2`, 60, paymentMethodsY + 38);
        
        // Credit/Debit (3% Fee)
        doc.fontSize(8).font('Helvetica-Bold')
           .fillColor('black')
           .text(`Credit/Debit: $${cardAmount.toFixed(2)} (3% Fee) Call with card number`, 60, paymentMethodsY + 50);
        
        // Notes section (if notes exist) - bigger text
        let finalY = paymentMethodsY + 65;
        if (invoice.Notes) {
            const notesY = footerY + 25;
            doc.fontSize(8).font('Helvetica-Bold') // Bigger
               .fillColor(brandBlue)
               .text('NOTES', 50, notesY);
            
            doc.fontSize(7).font('Helvetica') // Bigger
               .fillColor('black')
               .text(invoice.Notes, 50, notesY + 12, { width: 500 });
            finalY = notesY + 35; // Adjust final position
        }
        
        // Company footer - bigger text and positioned dynamically
        const companyFooterY = finalY + 10;
        doc.fontSize(7).font('Helvetica') // Bigger
           .fillColor(darkGray)
           .text('OMEGA BUILDERS, LLC', 50, companyFooterY)
           .text(`Invoice generated on ${new Date().toLocaleDateString()}`, 50, companyFooterY + 10)
           .text('Professional Design Services', 350, companyFooterY)
           .text('Thank you for choosing Omega Builders!', 350, companyFooterY + 10);
        
        // Bottom accent border - positioned dynamically
        const borderY = companyFooterY + 25;
        doc.rect(50, borderY, doc.page.width - 100, 2)
           .fillColor(brandBlue).fill();
        
        doc.end();
        
    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
});

// Helper function to generate invoice HTML
async function generateInvoiceHTML(invoice) {
    const currentDate = new Date().toLocaleDateString();
    const settings = await settingsHelper.getSettings();
    
    let lineItemsHTML = '';
    invoice.lineItems.forEach(item => {
        lineItemsHTML += `
            <tr>
                <td>${item.ItemDescription || item.ItemName || ''}</td>
                <td style="text-align: center;">${item.Quantity}</td>
                <td style="text-align: center;">${item.UnitOfMeasure || 'each'}</td>
                <td style="text-align: right;">$${parseFloat(item.UnitRate).toFixed(2)}</td>
                <td style="text-align: right;">$${parseFloat(item.LineTotal).toFixed(2)}</td>
            </tr>
        `;
    });
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>Invoice ${invoice.InvoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .bill-to { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .totals { margin-left: auto; width: 300px; }
        .total-row { font-weight: bold; }
        .notes { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>INVOICE</h1>
        <h2>${invoice.InvoiceNumber}</h2>
    </div>
    
    <div class="invoice-details">
        <div>
            <strong>Invoice Date:</strong> ${new Date(invoice.InvoiceDate).toLocaleDateString()}<br>
            ${invoice.DueDate ? `<strong>Due Date:</strong> ${new Date(invoice.DueDate).toLocaleDateString()}<br>` : ''}
            <strong>Project:</strong> ${invoice.ProjectName}
        </div>
        <div>
            <strong>Status:</strong> ${invoice.InvoiceStatus}<br>
            ${invoice.BalanceDue > 0 ? `<strong>Balance Due:</strong> $${parseFloat(invoice.BalanceDue).toFixed(2)}` : ''}
        </div>
    </div>
    
    <div class="bill-to">
        <strong>Bill To:</strong><br>
        ${invoice.CompanyName}<br>
        ${invoice.ContactName ? invoice.ContactName + '<br>' : ''}
        ${invoice.Address ? invoice.Address + '<br>' : ''}
        ${invoice.Email ? 'Email: ' + invoice.Email : ''}
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${lineItemsHTML}
        </tbody>
    </table>
    
    <div class="totals">
        <table>
            <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">$${parseFloat(invoice.SubTotal).toFixed(2)}</td>
            </tr>
            <tr>
                <td>Tax (${(invoice.TaxRate * 100).toFixed(2)}%):</td>
                <td style="text-align: right;">$${parseFloat(invoice.TaxAmount).toFixed(2)}</td>
            </tr>
            <tr class="total-row">
                <td>Total:</td>
                <td style="text-align: right;">$${parseFloat(invoice.TotalAmount).toFixed(2)}</td>
            </tr>
            ${invoice.PaidAmount > 0 ? `
            <tr>
                <td>Paid:</td>
                <td style="text-align: right;">-$${parseFloat(invoice.PaidAmount).toFixed(2)}</td>
            </tr>
            <tr class="total-row">
                <td>Balance Due:</td>
                <td style="text-align: right;">$${parseFloat(invoice.BalanceDue).toFixed(2)}</td>
            </tr>
            ` : ''}
        </table>
    </div>
    
    ${invoice.Notes ? `
    <div class="notes">
        <strong>Notes:</strong><br>
        ${invoice.Notes}
    </div>
    ` : ''}
    
    <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
        Invoice generated on ${currentDate}
    </div>
</body>
</html>`;

// Add this route for the frontend dropdown:

router.get('/line-items', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT LineItemID, ItemCode, ItemName, 
                   ItemDescription, Category, UnitOfMeasure, 
                   StandardRate, IsActive
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

// Send paid invoice email with PAID stamp
router.post('/send-paid-email', async (req, res) => {
    try {
        const { invoiceId } = req.body;
        
        if (!invoiceId) {
            return res.status(400).json({ error: 'Invoice ID is required' });
        }

        // Get full invoice details with customer info
        const invoiceResult = await database.query(`
            SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.DueDate, 
                i.SubTotal as Subtotal, i.TaxRate, i.TaxAmount, i.TotalAmount, i.PaidAmount, 
                (i.TotalAmount - i.PaidAmount) as BalanceDue, i.InvoiceStatus, 
                i.Notes, i.CreatedDate, i.ModifiedDate,
                p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState,
                c.CustomerID, c.CompanyName, c.ContactName, c.Phone, c.Email, c.Email1, c.Address,
                e.EstimateID, e.EstimateNumber
            FROM Invoices i
            INNER JOIN Projects p ON i.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            LEFT JOIN Estimates e ON i.EstimateID = e.EstimateID
            WHERE i.InvoiceID = @invoiceId
        `, { invoiceId });
        
        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.recordset[0];
        const customerEmail = invoice.Email1 || invoice.Email;
        
        if (!customerEmail) {
            return res.status(400).json({ error: 'Customer email not available' });
        }

        // Get invoice line items
        const lineItemsResult = await database.query(`
            SELECT ili.InvoiceLineItemID, ili.Quantity, ili.UnitRate, 
                ili.LineTotal, ili.ItemDescription, ili.SortOrder,
                lm.LineItemID, lm.ItemCode, lm.ItemName, lm.Category, lm.UnitOfMeasure
            FROM InvoiceLineItems ili
            LEFT JOIN LineItemsMaster lm ON ili.LineItemID = lm.LineItemID
            WHERE ili.InvoiceID = @invoiceId
            ORDER BY ili.SortOrder, ili.InvoiceLineItemID
        `, { invoiceId });

        invoice.LineItems = lineItemsResult.recordset;

        // Generate PDF with PAID stamp
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        
        const pdfPromise = new Promise((resolve) => {
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
        });

        // Generate PDF content with PAID stamp
        await generatePaidInvoicePDF(doc, invoice);
        doc.end();
        
        const pdfBuffer = await pdfPromise;

        // TODO: Implement actual email sending
        // For now, we'll just simulate success
        console.log(`Would send paid invoice email to: ${customerEmail}`);
        console.log(`Invoice: ${invoice.InvoiceNumber || invoice.InvoiceID}`);
        console.log(`PDF size: ${pdfBuffer.length} bytes`);

        res.json({ 
            message: 'Paid invoice email would be sent successfully',
            email: customerEmail,
            invoiceNumber: invoice.InvoiceNumber || invoice.InvoiceID,
            companyName: invoice.CompanyName
        });

    } catch (error) {
        console.error('Error sending paid invoice email:', error);
        res.status(500).json({ error: 'Failed to send paid invoice email' });
    }
});

// Helper function to generate PDF with PAID stamp
async function generatePaidInvoicePDF(doc, invoice) {
    // Header with company info
    doc.fontSize(20).text('Omega Builders Inc.', 50, 50);
    doc.fontSize(12).text('Licensed General Contractor', 50, 75);
    doc.text('License #1234567', 50, 90);
    doc.text('Phone: (555) 123-4567', 50, 105);
    doc.text('Email: info@omegabuilders.com', 50, 120);

    // PAID Stamp (prominent red stamp)
    doc.save();
    doc.rotate(30, { origin: [400, 150] });
    doc.fontSize(48)
       .fillColor('#DC3545')
       .strokeColor('#DC3545')
       .lineWidth(3)
       .rect(350, 120, 140, 60)
       .stroke()
       .text('PAID', 380, 140, { width: 80, align: 'center' })
       .fillColor('#000000'); // Reset color
    doc.restore();

    // Invoice details
    doc.fontSize(16).text(`Invoice #${invoice.InvoiceNumber || invoice.InvoiceID}`, 50, 200);
    doc.fontSize(12);
    doc.text(`Invoice Date: ${invoice.InvoiceDate ? new Date(invoice.InvoiceDate).toLocaleDateString() : 'N/A'}`, 50, 225);
    doc.text(`Due Date: ${invoice.DueDate ? new Date(invoice.DueDate).toLocaleDateString() : 'N/A'}`, 50, 240);

    // Customer info
    doc.text('Bill To:', 50, 270);
    doc.text(invoice.CompanyName || 'N/A', 50, 285);
    if (invoice.ContactName) doc.text(invoice.ContactName, 50, 300);
    if (invoice.Address) doc.text(invoice.Address, 50, 315);

    // Project info
    doc.text('Project:', 300, 270);
    doc.text(invoice.ProjectName || 'N/A', 300, 285);
    if (invoice.ProjectAddress) {
        doc.text(invoice.ProjectAddress, 300, 300);
        if (invoice.ProjectCity && invoice.ProjectState) {
            doc.text(`${invoice.ProjectCity}, ${invoice.ProjectState}`, 300, 315);
        }
    }

    // Line items table
    let yPosition = 350;
    doc.text('Description', 50, yPosition);
    doc.text('Qty', 350, yPosition);
    doc.text('Rate', 400, yPosition);
    doc.text('Amount', 500, yPosition);
    
    // Line under header
    doc.moveTo(50, yPosition + 15).lineTo(550, yPosition + 15).stroke();
    yPosition += 25;

    let total = 0;
    if (invoice.LineItems && invoice.LineItems.length > 0) {
        invoice.LineItems.forEach(item => {
            doc.text(item.ItemDescription || 'N/A', 50, yPosition, { width: 280 });
            doc.text(item.Quantity?.toString() || '0', 350, yPosition);
            doc.text(`$${(item.UnitRate || 0).toFixed(2)}`, 400, yPosition);
            doc.text(`$${(item.LineTotal || 0).toFixed(2)}`, 500, yPosition);
            yPosition += 20;
            total += item.LineTotal || 0;
        });
    }

    // Totals section
    yPosition += 10;
    doc.moveTo(400, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 10;

    doc.text(`Subtotal: $${(invoice.Subtotal || 0).toFixed(2)}`, 400, yPosition);
    yPosition += 15;
    
    if (invoice.TaxRate && invoice.TaxRate > 0) {
        doc.text(`Tax (${invoice.TaxRate}%): $${(invoice.TaxAmount || 0).toFixed(2)}`, 400, yPosition);
        yPosition += 15;
    }

    doc.fontSize(14).text(`Total: $${(invoice.TotalAmount || 0).toFixed(2)}`, 400, yPosition);
    yPosition += 20;
    
    // PAID amount
    doc.fillColor('#28a745').text(`PAID: $${(invoice.PaidAmount || 0).toFixed(2)}`, 400, yPosition);
    doc.fillColor('#000000'); // Reset color
    
    // Payment methods section
    yPosition += 30;
    const totalAmount = parseFloat(invoice.TotalAmount || 0);
    const venmoAmount = totalAmount * 1.0175; // 1.75% fee
    const cardAmount = totalAmount * 1.03; // 3% fee
    
    doc.fontSize(12).text('PAYMENT METHODS:', 50, yPosition);
    yPosition += 20;
    
    // Check or Zelle (No Fees)
    doc.fontSize(10).text(`Check or Zelle: (No Fees) $${totalAmount.toFixed(2)} (Zelle service provided by your bank)`, 50, yPosition);
    yPosition += 12;
    doc.fontSize(9).text('Zelle ID: darren@omega-builders.com, Check: Mail to the address above', 50, yPosition);
    yPosition += 18;
    
    // Venmo (1.75% Fee)
    doc.fontSize(10).text(`Venmo: $${venmoAmount.toFixed(2)} (1.75% Fee) Venmo ID: @Darren-Anderson-2`, 50, yPosition);
    yPosition += 18;
    
    // Credit/Debit (3% Fee)
    doc.fontSize(10).text(`Credit/Debit: $${cardAmount.toFixed(2)} (3% Fee) Call with card number`, 50, yPosition);

    // Footer
    yPosition += 30;
    doc.fontSize(10).text('Thank you for your business!', 50, yPosition);
    doc.text('This invoice has been marked as PAID.', 50, yPosition + 15);
}

}

// Generate HTML email template for invoices
async function generateInvoiceEmailHTML(invoice) {
    const formatCurrency = (amount) => `$${parseFloat(amount || 0).toFixed(2)}`;
    const formatDate = (date) => new Date(date).toLocaleDateString();
    const settings = await settingsHelper.getSettings();
    
    // Calculate totals exactly like the PDF
    let runningTotal = 0;
    if (invoice.lineItems && invoice.lineItems.length > 0) {
        invoice.lineItems.forEach(item => {
            const quantity = parseFloat(item.Quantity || 1);
            const unitRate = parseFloat(item.UnitRate || 0);
            runningTotal += quantity * unitRate;
        });
    } else {
        runningTotal = parseFloat(invoice.TotalAmount || 0);
    }
    
    const totalAmount = parseFloat(invoice.TotalAmount || 0);
    const venmoAmount = totalAmount * 1.0175; // 1.75% fee
    const cardAmount = totalAmount * 1.03; // 3% fee
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoice.InvoiceNumber}</title>
    <style>
        /* Base styles - optimized for mobile */
        body { 
            font-family: 'Helvetica', Arial, sans-serif; 
            line-height: 1.4; 
            color: #000; 
            margin: 0; 
            padding: 20px; 
            background-color: #fff; 
            font-size: 12px;
        }
        
        /* Desktop/Computer styles - larger text for better readability */
        @media only screen and (min-width: 768px) {
            body {
                font-size: 16px;
                line-height: 1.5;
                padding: 30px;
            }
            .company-info h1 { 
                font-size: 24px !important;
            }
            .company-tagline { 
                font-size: 14px !important;
            }
            .invoice-title { 
                font-size: 28px !important;
            }
            .invoice-number { 
                font-size: 16px !important;
                padding: 6px 12px !important;
            }
            .bill-to h3 { 
                font-size: 15px !important;
            }
            .customer-name { 
                font-size: 16px !important;
            }
            .customer-details { 
                font-size: 14px !important;
            }
            .details-box { 
                font-size: 14px !important;
            }
            .table th {
                font-size: 14px !important;
                padding: 12px 8px !important;
            }
            .table td {
                font-size: 14px !important;
                padding: 10px 8px !important;
            }
            .total-row {
                font-size: 16px !important;
            }
            .payment-section h3 {
                font-size: 18px !important;
            }
            .payment-method {
                font-size: 15px !important;
            }
            .footer-text {
                font-size: 14px !important;
            }
        }
        
        /* Extra large screens - even bigger text */
        @media only screen and (min-width: 1200px) {
            body {
                font-size: 18px;
                padding: 40px;
            }
            .company-info h1 { 
                font-size: 28px !important;
            }
            .invoice-title { 
                font-size: 32px !important;
            }
            .table th, .table td {
                font-size: 16px !important;
            }
        }
        
        .invoice-container { 
            max-width: 700px; 
            margin: 0 auto; 
            background: white; 
            padding: 0;
        }
        
        /* Header Section - exactly like PDF */
        .header-border { 
            height: 3px; 
            background-color: #1e3d59; 
            margin-bottom: 15px; 
        }
        .header-section { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 30px; 
        }
        .company-info h1 { 
            font-size: 18px; 
            font-weight: bold; 
            color: #1e3d59; 
            margin: 0 0 5px 0; 
        }
        .company-tagline { 
            font-size: 10px; 
            color: #495057; 
            margin: 0; 
        }
        .invoice-info { 
            text-align: right; 
        }
        .invoice-title { 
            font-size: 20px; 
            font-weight: bold; 
            color: #1e3d59; 
            margin: 0; 
        }
        .invoice-number { 
            background: #17a2b8; 
            color: white; 
            padding: 4px 8px; 
            font-weight: bold; 
            font-size: 12px; 
            margin-top: 5px; 
            display: inline-block; 
        }
        
        /* Details Section - exactly like PDF */
        .details-section { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px; 
        }
        .bill-to { 
            width: 45%; 
        }
        .bill-to h3 { 
            font-size: 11px; 
            font-weight: bold; 
            color: #1e3d59; 
            margin: 0 0 8px 0; 
        }
        .bill-to-box { 
            border: 1px solid #dee2e6; 
            padding: 10px; 
            min-height: 60px; 
        }
        .customer-name { 
            font-weight: bold; 
            font-size: 12px; 
            margin-bottom: 5px; 
        }
        .customer-details { 
            font-size: 10px; 
            color: #495057; 
            line-height: 1.3; 
        }
        
        .invoice-details { 
            width: 30%; 
        }
        .details-box { 
            border: 1px solid #dee2e6; 
            background: #f8f9fa; 
            padding: 10px; 
            font-size: 10px; 
        }
        .detail-row { 
            margin-bottom: 8px; 
        }
        .detail-label { 
            font-weight: bold; 
            color: #495057; 
            font-size: 9px; 
            text-transform: uppercase; 
        }
        .detail-value { 
            font-size: 10px; 
            color: #000; 
        }
        .status-sent { color: #17a2b8; font-weight: bold; }
        .status-paid { color: #28a745; font-weight: bold; }
        .status-unpaid { color: #dc3545; font-weight: bold; }
        
        /* Project Section - exactly like PDF */
        .project-section { 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            padding: 8px 12px; 
            margin-bottom: 20px; 
        }
        .project-name { 
            font-weight: bold; 
            font-size: 10px; 
            margin-bottom: 3px; 
        }
        .project-location { 
            font-size: 9px; 
            color: #495057; 
        }
        
        /* Line Items Table - exactly like PDF */
        .line-items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
        }
        .table-header { 
            background: #1e3d59; 
            color: white; 
            font-size: 10px; 
            font-weight: bold; 
        }
        .table-header th { 
            padding: 8px 6px; 
            text-align: left; 
            border: none; 
        }
        .table-header .qty-col { text-align: center; }
        .table-header .rate-col { text-align: right; }
        .table-header .total-col { text-align: right; }
        
        .line-item { 
            font-size: 10px; 
            border-left: 3px solid #17a2b8; 
        }
        .line-item:nth-child(even) { 
            background: #f8f9fa; 
        }
        .line-item td { 
            padding: 6px; 
            border-bottom: 1px solid #dee2e6; 
        }
        .item-desc { width: 55%; }
        .item-qty { text-align: center; width: 10%; }
        .item-rate { text-align: right; width: 15%; }
        .item-total { text-align: right; width: 20%; font-weight: bold; }
        
        .table-bottom-border { 
            height: 3px; 
            background: #1e3d59; 
            margin-bottom: 15px; 
        }
        
        /* Totals Section - exactly like PDF */
        .totals-section { 
            display: flex; 
            justify-content: flex-end; 
            margin-bottom: 30px; 
        }
        .totals-box { 
            border: 1px solid #dee2e6; 
            width: 200px; 
        }
        .totals-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 6px 12px; 
            font-size: 10px; 
            border-bottom: 1px solid #dee2e6; 
        }
        .totals-row:last-child { border-bottom: none; }
        .total-final { 
            background: #1e3d59; 
            color: white; 
            font-weight: bold; 
            font-size: 12px; 
        }
        .balance-due { 
            background: rgba(220, 53, 69, 0.1); 
            color: #dc3545; 
            font-weight: bold; 
        }
        
        /* Payment Terms - exactly like PDF */
        .payment-terms { 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            padding: 10px 12px; 
            margin-bottom: 15px; 
        }
        .payment-terms h3 { 
            font-size: 11px; 
            font-weight: bold; 
            color: #1e3d59; 
            margin: 0 0 5px 0; 
        }
        .payment-terms p { 
            font-size: 10px; 
            margin: 0; 
        }
        
        /* Payment Methods - exactly like PDF */
        .payment-methods { 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            padding: 10px 12px; 
            margin-bottom: 20px; 
        }
        .payment-methods h3 { 
            font-size: 11px; 
            font-weight: bold; 
            color: #1e3d59; 
            margin: 0 0 8px 0; 
        }
        .payment-method { 
            font-size: 10px; 
            margin-bottom: 5px; 
        }
        .payment-method strong { 
            font-weight: bold; 
        }
        .payment-sub { 
            font-size: 9px; 
            color: #495057; 
            margin-left: 10px; 
        }
        
        /* Notes Section */
        .notes-section { 
            margin-bottom: 20px; 
        }
        .notes-section h3 { 
            font-size: 10px; 
            font-weight: bold; 
            color: #1e3d59; 
            margin: 0 0 5px 0; 
        }
        .notes-section p { 
            font-size: 9px; 
            margin: 0; 
        }
        
        /* Footer - exactly like PDF */
        .footer-section { 
            display: flex; 
            justify-content: space-between; 
            font-size: 9px; 
            color: #495057; 
            margin-top: 20px; 
            padding-top: 10px; 
        }
        .footer-bottom-border { 
            height: 3px; 
            background: #1e3d59; 
            margin-top: 15px; 
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header Section -->
        <div class="header-border"></div>
        <div class="header-section">
            <div class="company-info">
                <h1>${settings.company_name}</h1>
                <p class="company-tagline">Professional Design Services</p>
            </div>
            <div class="invoice-info">
                <h1 class="invoice-title">INVOICE</h1>
                <div class="invoice-number">#${invoice.InvoiceNumber}</div>
            </div>
        </div>

        <!-- Details Section -->
        <div class="details-section">
            <div class="bill-to">
                <h3>BILL TO</h3>
                <div class="bill-to-box">
                    <div class="customer-name">${invoice.CompanyName || 'N/A'}</div>
                    <div class="customer-details">
                        ${invoice.ContactName ? `${invoice.ContactName}<br>` : ''}
                        ${invoice.Address ? `${invoice.Address}<br>` : ''}
                        ${[invoice.City, invoice.State, invoice.ZipCode].filter(Boolean).join(', ')}
                    </div>
                </div>
            </div>
            
            <div class="invoice-details">
                <div class="details-box">
                    <div class="detail-row">
                        <div class="detail-label">INVOICE DATE</div>
                        <div class="detail-value">${formatDate(invoice.InvoiceDate)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">DUE DATE</div>
                        <div class="detail-value">Due now</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">STATUS</div>
                        <div class="detail-value status-${invoice.InvoiceStatus?.toLowerCase() || 'unpaid'}">
                            ${invoice.InvoiceStatus || 'Unpaid'}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Project Section -->
        <div class="project-section">
            <div class="project-name">${invoice.ProjectName || 'N/A'}</div>
            ${invoice.ProjectAddress ? `<div class="project-location">${[
                invoice.ProjectAddress,
                [invoice.ProjectCity, invoice.ProjectState, invoice.ProjectZip].filter(Boolean).join(', ')
            ].filter(Boolean).join(', ')}</div>` : ''}
        </div>

        <!-- Line Items Table -->
        <table class="line-items-table">
            <thead>
                <tr class="table-header">
                    <th class="desc-col">DESCRIPTION</th>
                    <th class="qty-col">QTY</th>
                    <th class="rate-col">RATE</th>
                    <th class="total-col">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.lineItems && invoice.lineItems.length > 0 ? 
                    invoice.lineItems.map((item, index) => {
                        const quantity = parseFloat(item.Quantity || 1);
                        const unitRate = parseFloat(item.UnitRate || 0);
                        const lineTotal = quantity * unitRate;
                        return `
                            <tr class="line-item">
                                <td class="item-desc">${item.ItemDescription || item.ItemName || 'Professional Services'}</td>
                                <td class="item-qty">${quantity}</td>
                                <td class="item-rate">${formatCurrency(unitRate)}</td>
                                <td class="item-total">${formatCurrency(lineTotal)}</td>
                            </tr>
                        `;
                    }).join('')
                    : 
                    `<tr class="line-item">
                        <td class="item-desc">Professional Services</td>
                        <td class="item-qty">1</td>
                        <td class="item-rate">${formatCurrency(totalAmount)}</td>
                        <td class="item-total">${formatCurrency(totalAmount)}</td>
                    </tr>`
                }
            </tbody>
        </table>
        <div class="table-bottom-border"></div>

        <!-- Totals Section -->
        <div class="totals-section">
            <div class="totals-box">
                <div class="totals-row">
                    <span>Subtotal</span>
                    <span>${formatCurrency(invoice.SubTotal || runningTotal)}</span>
                </div>
                ${invoice.TaxRate && invoice.TaxRate > 0 ? `
                    <div class="totals-row">
                        <span>Tax (${(parseFloat(invoice.TaxRate) * 100).toFixed(1)}%)</span>
                        <span>${formatCurrency(invoice.TaxAmount)}</span>
                    </div>
                ` : ''}
                <div class="totals-row total-final">
                    <span>TOTAL</span>
                    <span>${formatCurrency(invoice.TotalAmount)}</span>
                </div>
                ${invoice.PaidAmount && invoice.PaidAmount > 0 ? `
                    <div class="totals-row">
                        <span>Amount Paid</span>
                        <span>-${formatCurrency(invoice.PaidAmount)}</span>
                    </div>
                    <div class="totals-row balance-due">
                        <span>BALANCE DUE</span>
                        <span>${formatCurrency(invoice.BalanceDue)}</span>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Payment Terms -->
        <div class="payment-terms">
            <h3>PAYMENT TERMS</h3>
            <p>Payment is due immediately upon receipt of this invoice. Thank you for your business!</p>
        </div>

        <!-- Payment Methods -->
        <div class="payment-methods">
            <h3>PAYMENT METHODS</h3>
            <div class="payment-method">
                <strong>Check or Zelle: (No Fees) ${formatCurrency(totalAmount)}</strong>
                <div class="payment-sub">Zelle ID: darren@omega-builders.com, Check: Mail to the address above</div>
            </div>
            <div class="payment-method">
                <strong>Venmo: ${formatCurrency(venmoAmount)} (1.75% Fee)</strong>
                <div class="payment-sub">Venmo ID: @Darren-Anderson-2</div>
            </div>
            <div class="payment-method">
                <strong>Credit/Debit: ${formatCurrency(cardAmount)} (3% Fee)</strong>
                <div class="payment-sub">Call with card number</div>
            </div>
        </div>

        ${invoice.Notes ? `
            <div class="notes-section">
                <h3>NOTES</h3>
                <p>${invoice.Notes}</p>
            </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer-section">
            <div>
                <div>${settings.company_name}</div>
                <div>Invoice generated on ${new Date().toLocaleDateString()}</div>
            </div>
            <div>
                <div>Professional Design Services</div>
                <div>${settings.invoice_footer}</div>
            </div>
        </div>
        <div class="footer-bottom-border"></div>
    </div>
</body>
</html>`;
}

module.exports = router;