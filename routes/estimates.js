// routes/estimates.js - Complete Working Version
const express = require('express');
const router = express.Router();
const database = require('../config/database');
const settingsHelper = require('../utils/settingsHelper');

// Get all line items (MUST come BEFORE /:id route)
router.get('/line-items', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT LineItemID, ItemCode, ItemName, ItemDescription, 
                   Category, UnitOfMeasure, StandardRate, IsActive
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

// Get all estimates with project and customer info
router.get('/', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT e.EstimateID, e.EstimateNumber, e.EstimateDate, e.ValidUntilDate,
                   e.SubTotal, e.TaxRate, e.TaxAmount, e.TotalAmount, e.EstimateStatus,
                   e.Notes, e.CreatedDate, e.ModifiedDate,
                   p.ProjectID, p.ProjectName,
                   c.CustomerID, c.CompanyName
            FROM Estimates e
            INNER JOIN Projects p ON e.ProjectID = p.ProjectID
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            ORDER BY e.CreatedDate DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching estimates:', error);
        res.status(500).json({ error: 'Failed to fetch estimates' });
    }
});

// Get single estimate by ID with line items (CRITICAL - this was missing!)
router.get('/:id', async (req, res) => {
    try {
        const estimateId = parseInt(req.params.id);
        
        if (isNaN(estimateId)) {
            return res.status(400).json({ error: 'Invalid estimate ID' });
        }

        // Get estimate header with project and customer info
        const estimateResult = await database.query(`
            SELECT e.EstimateID, e.EstimateNumber, e.EstimateDate, e.ValidUntilDate,
                   e.EstimateStatus, e.SubTotal, e.TaxRate, e.TaxAmount, e.TotalAmount, e.Notes,
                   e.ProjectID, p.ProjectName, 
                   c.CompanyName, c.ContactName, c.Phone, c.Email,
                   c.Address, c.City, c.State, c.ZipCode
            FROM Estimates e
            LEFT JOIN Projects p ON e.ProjectID = p.ProjectID
            LEFT JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE e.EstimateID = @estimateId
        `, { estimateId });
        
        if (estimateResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }

        // Get line items for this estimate (THIS WAS THE MISSING PIECE!)
        const lineItemsResult = await database.query(`
            SELECT eli.EstimateLineItemID, eli.Quantity, eli.UnitRate, 
                   eli.ItemDescription, eli.SortOrder
            FROM EstimateLineItems eli
            WHERE eli.EstimateID = @estimateId
            ORDER BY eli.SortOrder, eli.EstimateLineItemID
        `, { estimateId });

        const estimate = estimateResult.recordset[0];
        estimate.LineItems = lineItemsResult.recordset;

        console.log(`Estimate ${estimateId} loaded with ${estimate.LineItems.length} line items`);
        res.json(estimate);
    } catch (error) {
        console.error('Error fetching estimate:', error);
        res.status(500).json({ error: 'Failed to fetch estimate' });
    }
});

// Create new estimate
router.post('/', async (req, res) => {
    try {
        console.log('POST /api/estimates - Full request body:', JSON.stringify(req.body, null, 2));
        const { projectId, estimateDate, validUntilDate, estimateStatus, taxRate, notes, exclusions, lineItems } = req.body;
        console.log('Line items received:', JSON.stringify(lineItems, null, 2));

        // Generate estimate number
        const numberResult = await database.query(`
            SELECT TOP 1 EstimateNumber 
            FROM Estimates 
            WHERE EstimateNumber LIKE 'EST-%'
            ORDER BY EstimateID DESC
        `);

        let estimateNumber = 'EST-1150';
        if (numberResult.recordset.length > 0) {
            const lastNumber = numberResult.recordset[0].EstimateNumber;
            const numberPart = parseInt(lastNumber.split('-')[1]) + 1;
            // Ensure we never go below 1150
            const nextNumber = Math.max(numberPart, 1150);
            estimateNumber = `EST-${nextNumber.toString().padStart(4, '0')}`;
        }

        // Calculate totals
        let subtotal = 0;
        if (lineItems && lineItems.length > 0) {
            subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitRate), 0);
        }
        
        const finalTaxRate = taxRate !== undefined && taxRate !== null ? parseFloat(taxRate) : 0.0875;
        console.log('Final tax rate being saved:', finalTaxRate);
        const taxAmount = subtotal * finalTaxRate;
        const totalAmount = subtotal + taxAmount;

        // Combine exclusions and notes
        let combinedNotes = '';
        if (exclusions && exclusions.trim()) {
            combinedNotes += exclusions.trim();
        }
        if (notes && notes.trim()) {
            if (combinedNotes) combinedNotes += '\n\n';
            combinedNotes += notes.trim();
        }

        // Insert estimate using correct column names
        const insertResult = await database.query(`
            INSERT INTO Estimates (ProjectID, EstimateNumber, EstimateDate, ValidUntilDate, 
                                 EstimateStatus, SubTotal, TaxRate, TaxAmount, TotalAmount, Notes)
            OUTPUT INSERTED.EstimateID
            VALUES (@projectId, @estimateNumber, @estimateDate, @validUntilDate, 
                    @estimateStatus, @subtotal, @taxRate, @taxAmount, @totalAmount, @notes)
        `, {
            projectId,
            estimateNumber,
            estimateDate,
            validUntilDate,
            estimateStatus: estimateStatus || 'Draft',
            subtotal,
            taxRate: finalTaxRate,
            taxAmount,
            totalAmount,
            notes: combinedNotes
        });

        const estimateId = insertResult.recordset[0].EstimateID;

// Insert line items
        if (lineItems && lineItems.length > 0) {
            console.log('Processing line items for new estimate:', lineItems.length);
            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                console.log(`Processing line item ${i}:`, JSON.stringify(item, null, 2));
                
                // Combine itemDescription with notes for full description
                let fullDescription = item.itemDescription || '';
                if (item.notes && item.notes.trim()) {
                    fullDescription += ': ' + item.notes.trim();
                }
                
                await database.query(`
                    INSERT INTO EstimateLineItems (EstimateID, LineItemID, Quantity, UnitRate, ItemDescription, SortOrder)
                    VALUES (@estimateId, 1, @quantity, @unitRate, @itemDescription, @sortOrder)
                `, {
                    estimateId,
                    quantity: item.quantity,
                    unitRate: item.unitRate,
                    itemDescription: fullDescription,
                    sortOrder: i
                });
                console.log(`Line item ${i} inserted successfully for new estimate`);
            }
        } else {
            console.log('No line items to process for new estimate');
        }

        res.status(201).json({ 
            estimateId, 
            estimateNumber, 
            message: 'Estimate created successfully' 
        });
    } catch (error) {
        console.error('Error creating estimate:', error);
        res.status(500).json({ error: 'Failed to create estimate' });
    }
});

// Update estimate
router.put('/:id', async (req, res) => {
    try {
        const estimateId = parseInt(req.params.id);
        
        if (isNaN(estimateId)) {
            return res.status(400).json({ error: 'Invalid estimate ID' });
        }

        console.log('PUT /api/estimates/:id - Full request body:', JSON.stringify(req.body, null, 2));
        const { projectId, estimateDate, validUntilDate, estimateStatus, taxRate, notes, exclusions, lineItems } = req.body;
        console.log('Line items received:', JSON.stringify(lineItems, null, 2));

        // Calculate totals
        let subtotal = 0;
        if (lineItems && lineItems.length > 0) {
            subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitRate), 0);
        }
        
        const finalTaxRate = taxRate !== undefined && taxRate !== null ? parseFloat(taxRate) : 0.0875;
        const taxAmount = subtotal * finalTaxRate;
        const totalAmount = subtotal + taxAmount;

        // Combine exclusions and notes
        let combinedNotes = '';
        if (exclusions && exclusions.trim()) {
            combinedNotes += exclusions.trim();
        }
        if (notes && notes.trim()) {
            if (combinedNotes) combinedNotes += '\n\n';
            combinedNotes += notes.trim();
        }

        // Update estimate using correct column names
        await database.query(`
            UPDATE Estimates 
            SET ProjectID = @projectId, EstimateDate = @estimateDate, ValidUntilDate = @validUntilDate,
                EstimateStatus = @estimateStatus, SubTotal = @subtotal, TaxRate = @taxRate,
                TaxAmount = @taxAmount, TotalAmount = @totalAmount, Notes = @notes,
                ModifiedDate = GETDATE()
            WHERE EstimateID = @estimateId
        `, {
            estimateId,
            projectId,
            estimateDate,
            validUntilDate,
            estimateStatus,
            subtotal,
            taxRate: finalTaxRate,
            taxAmount,
            totalAmount,
            notes: combinedNotes
        });

        // Delete existing line items
        await database.query(`
            DELETE FROM EstimateLineItems WHERE EstimateID = @estimateId
        `, { estimateId });

// Insert new line items
        if (lineItems && lineItems.length > 0) {
            console.log('Processing line items:', lineItems.length);
            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                console.log(`Processing line item ${i}:`, JSON.stringify(item, null, 2));
                
                // Combine itemDescription with notes for full description
                let fullDescription = item.itemDescription || '';
                if (item.notes && item.notes.trim()) {
                    fullDescription += ': ' + item.notes.trim();
                }
                
                await database.query(`
                    INSERT INTO EstimateLineItems (EstimateID, LineItemID, Quantity, UnitRate, ItemDescription, SortOrder)
                    VALUES (@estimateId, 1, @quantity, @unitRate, @itemDescription, @sortOrder)
                `, {
                    estimateId,
                    quantity: item.quantity,
                    unitRate: item.unitRate,
                    itemDescription: fullDescription,
                    sortOrder: i
                });
                console.log(`Line item ${i} inserted successfully`);
            }
        } else {
            console.log('No line items to process');
        }

        res.json({ message: 'Estimate updated successfully' });
    } catch (error) {
        console.error('Error updating estimate:', error);
        res.status(500).json({ error: 'Failed to update estimate' });
    }
});

// Delete estimate
router.delete('/:id', async (req, res) => {
    try {
        const estimateId = parseInt(req.params.id);
        
        if (isNaN(estimateId)) {
            return res.status(400).json({ error: 'Invalid estimate ID' });
        }

        // Check if estimate has related invoices
        const invoiceCheck = await database.query(`
            SELECT COUNT(*) as count FROM Invoices WHERE EstimateID = @estimateId
        `, { estimateId });

        if (invoiceCheck.recordset[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete estimate with associated invoices' });
        }

        // Delete line items first
        await database.query(`
            DELETE FROM EstimateLineItems WHERE EstimateID = @estimateId
        `, { estimateId });

        // Delete estimate
        await database.query(`
            DELETE FROM Estimates WHERE EstimateID = @estimateId
        `, { estimateId });

        res.json({ message: 'Estimate deleted successfully' });
    } catch (error) {
        console.error('Error deleting estimate:', error);
        res.status(500).json({ error: 'Failed to delete estimate' });
    }
});

// Convert estimate to invoice
router.post('/:id/convert-to-invoice', async (req, res) => {
    try {
        const estimateId = parseInt(req.params.id);
        
        if (isNaN(estimateId)) {
            return res.status(400).json({ error: 'Invalid estimate ID' });
        }

        // Get estimate details
        const estimateResult = await database.query(`
            SELECT * FROM Estimates WHERE EstimateID = @estimateId
        `, { estimateId });

        if (estimateResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }

        const estimate = estimateResult.recordset[0];

        // Generate invoice number
        const numberResult = await database.query(`
            SELECT TOP 1 InvoiceNumber 
            FROM Invoices 
            WHERE InvoiceNumber LIKE 'INV-%'
            ORDER BY InvoiceID DESC
        `);

        let invoiceNumber = 'INV-1150';
        if (numberResult.recordset.length > 0) {
            const lastNumber = numberResult.recordset[0].InvoiceNumber;
            const numberPart = parseInt(lastNumber.split('-')[1]) + 1;
            // Ensure we never go below 1150
            const nextNumber = Math.max(numberPart, 1150);
            invoiceNumber = `INV-${nextNumber.toString().padStart(4, '0')}`;
        }

        // Create invoice using correct column names
        const invoiceResult = await database.query(`
            INSERT INTO Invoices (ProjectID, EstimateID, InvoiceNumber, InvoiceDate, DueDate,
                                InvoiceStatus, Subtotal, TaxAmount, TotalAmount, Notes)
            OUTPUT INSERTED.InvoiceID
            VALUES (@projectId, @estimateId, @invoiceNumber, @invoiceDate, @dueDate,
                    'Draft', @subtotal, @taxAmount, @totalAmount, @notes)
        `, {
            projectId: estimate.ProjectID,
            estimateId: estimateId,
            invoiceNumber: invoiceNumber,
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
            subtotal: estimate.SubTotal,
            taxAmount: estimate.TaxAmount,
            totalAmount: estimate.TotalAmount,
            notes: estimate.Notes
        });

        const invoiceId = invoiceResult.recordset[0].InvoiceID;

        // Copy line items from estimate to invoice
        await database.query(`
            INSERT INTO InvoiceLineItems (InvoiceID, LineItemID, Quantity, UnitRate, ItemDescription, SortOrder)
            SELECT @invoiceId, 1, Quantity, UnitRate, ItemDescription, SortOrder
            FROM EstimateLineItems 
            WHERE EstimateID = @estimateId
        `, { invoiceId, estimateId });

        // Update estimate status
        await database.query(`
            UPDATE Estimates SET EstimateStatus = 'Approved' WHERE EstimateID = @estimateId
        `, { estimateId });

        res.json({ 
            invoiceId, 
            invoiceNumber, 
            message: 'Estimate converted to invoice successfully' 
        });
    } catch (error) {
        console.error('Error converting estimate to invoice:', error);
        res.status(500).json({ error: 'Failed to convert estimate to invoice' });
    }
});

// Simple test route
router.get('/test', (req, res) => {
    res.json({ message: 'Estimates route is working' });
});

// Generate PDF for estimate
router.get('/:id/pdf', async (req, res) => {
    try {
        const estimateId = parseInt(req.params.id);
        
        if (isNaN(estimateId)) {
            return res.status(400).json({ error: 'Invalid estimate ID' });
        }

        console.log(`Generating PDF for estimate ${estimateId}`);

        // Get full estimate data (reuse existing logic from GET /:id route)
        const estimateResult = await database.query(`
            SELECT e.EstimateID, e.EstimateNumber, e.EstimateDate, e.ValidUntilDate,
                   e.EstimateStatus, e.SubTotal, e.TaxRate, e.TaxAmount, e.TotalAmount, e.Notes,
                   e.ProjectID, p.ProjectName, 
                   c.CompanyName, c.ContactName, c.Phone, c.Email,
                   c.Address, c.City, c.State, c.ZipCode
            FROM Estimates e
            LEFT JOIN Projects p ON e.ProjectID = p.ProjectID
            LEFT JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE e.EstimateID = @estimateId
        `, { estimateId });
        
        if (estimateResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }

        // Get line items
        const lineItemsResult = await database.query(`
            SELECT eli.EstimateLineItemID, eli.Quantity, eli.UnitRate, 
                   eli.ItemDescription, eli.SortOrder
            FROM EstimateLineItems eli
            WHERE eli.EstimateID = @estimateId
            ORDER BY eli.SortOrder, eli.EstimateLineItemID
        `, { estimateId });

        const estimate = estimateResult.recordset[0];
        estimate.LineItems = lineItemsResult.recordset;

        // Import Puppeteer
        const puppeteer = require('puppeteer');

        // Generate HTML for the PDF using the same function as standalone generator
        const pdfHtml = await generateEstimatePdfHtml(estimate);
        console.log('Generated HTML length:', pdfHtml.length);
        
        // Launch Puppeteer and generate PDF
        let browser;
        try {
            console.log('Launching Puppeteer...');
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            });

            const page = await browser.newPage();
            
            console.log('Setting PDF content...');
            await page.setContent(pdfHtml);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('Generating PDF buffer...');
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                }
            });

            await browser.close();
            console.log('PDF buffer generated, size:', pdfBuffer.length);
            
            // Set response headers for PDF download
            const filename = `Estimate_${estimate.EstimateNumber}_${estimate.CompanyName || 'Customer'}.pdf`.replace(/[^a-zA-Z0-9_-]/g, '_');
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            res.send(pdfBuffer);

            console.log(`PDF generated successfully for estimate ${estimateId}`);
            
        } catch (puppeteerError) {
            console.error('Puppeteer error:', puppeteerError);
            if (browser) {
                await browser.close();
            }
            throw puppeteerError;
        }

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
    }
});

// Helper function to generate HTML for PDF (same as standalone generator)
async function generateEstimatePdfHtml(estimate) {
    const settings = await settingsHelper.getSettings();
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US');
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Estimate ${estimate.EstimateNumber || 'N/A'}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                font-size: 14px;
                margin: 20px;
                color: black;
            }
            h1 { color: black; }
            h2 { color: black; }
            p { color: black; }
            table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 10px 0;
            }
            th, td { 
                border: 1px solid black; 
                padding: 5px; 
                text-align: left;
            }
            th { background-color: #f0f0f0; }
        </style>
    </head>
    <body>
        <h1>Omega Builders, LLC</h1>
        <h2>ESTIMATE ${estimate.EstimateNumber || 'N/A'}</h2>
        
        <p><strong>Date:</strong> ${formatDate(estimate.EstimateDate)}</p>
        <p><strong>Customer:</strong> ${estimate.CompanyName || 'N/A'}</p>
        <p><strong>Project:</strong> ${estimate.ProjectName || 'N/A'}</p>
        
        <h2>Line Items</h2>
        <table>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Amount</th>
            </tr>
            ${(estimate.LineItems || []).map(item => `
            <tr>
                <td>${item.ItemDescription || ''}</td>
                <td>${item.Quantity || 0}</td>
                <td>${formatCurrency(item.UnitRate || 0)}</td>
                <td>${formatCurrency((item.Quantity || 0) * (item.UnitRate || 0))}</td>
            </tr>
            `).join('')}
        </table>
        
        <div style="text-align: right; margin-top: 20px;">
            <h2 style="margin: 0; padding: 10px; background-color: #f0f0f0; border: 1px solid #ccc; display: inline-block; min-width: 200px;">
                Total: ${formatCurrency(estimate.TotalAmount || 0)}
            </h2>
        </div>
        
        ${estimate.Notes ? `
        <h2>Notes & Exclusions</h2>
        <div style="border: 1px solid #ccc; padding: 10px; background-color: #f9f9f9; white-space: pre-wrap;">
            ${estimate.Notes}
        </div>
        ` : ''}
    </body>
    </html>
    `;
}

// Debug route to preview HTML
router.get('/:id/pdf-preview', async (req, res) => {
    try {
        const estimateId = parseInt(req.params.id);
        
        if (isNaN(estimateId)) {
            return res.status(400).json({ error: 'Invalid estimate ID' });
        }

        // Get full estimate data
        const estimateResult = await database.query(`
            SELECT e.EstimateID, e.EstimateNumber, e.EstimateDate, e.ValidUntilDate,
                   e.EstimateStatus, e.SubTotal, e.TaxRate, e.TaxAmount, e.TotalAmount, e.Notes,
                   e.ProjectID, p.ProjectName, 
                   c.CompanyName, c.ContactName, c.Phone, c.Email,
                   c.Address, c.City, c.State, c.ZipCode
            FROM Estimates e
            LEFT JOIN Projects p ON e.ProjectID = p.ProjectID
            LEFT JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE e.EstimateID = @estimateId
        `, { estimateId });
        
        if (estimateResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }

        // Get line items
        const lineItemsResult = await database.query(`
            SELECT eli.EstimateLineItemID, eli.Quantity, eli.UnitRate, 
                   eli.ItemDescription, eli.SortOrder
            FROM EstimateLineItems eli
            WHERE eli.EstimateID = @estimateId
            ORDER BY eli.SortOrder, eli.EstimateLineItemID
        `, { estimateId });

        const estimate = estimateResult.recordset[0];
        estimate.LineItems = lineItemsResult.recordset;

        // Generate HTML and send it directly
        const pdfHtml = await generateEstimatePdfHtml(estimate);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(pdfHtml);

    } catch (error) {
        console.error('Error generating HTML preview:', error);
        res.status(500).json({ error: 'Failed to generate HTML preview: ' + error.message });
    }
});

// Helper function to generate HTML for PDF
function generateEstimatePdfHtml(estimate) {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US');
    };

    // Create a very simple HTML for testing
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Estimate ${estimate.EstimateNumber || 'N/A'}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                font-size: 14px;
                margin: 20px;
                color: black;
            }
            h1 { color: black; }
            h2 { color: black; }
            p { color: black; }
            table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 10px 0;
            }
            th, td { 
                border: 1px solid black; 
                padding: 5px; 
                text-align: left;
            }
            th { background-color: #f0f0f0; }
        </style>
    </head>
    <body>
        <h1>Omega Builders, LLC</h1>
        <h2>ESTIMATE ${estimate.EstimateNumber || 'N/A'}</h2>
        
        <p><strong>Date:</strong> ${formatDate(estimate.EstimateDate)}</p>
        <p><strong>Customer:</strong> ${estimate.CompanyName || 'N/A'}</p>
        <p><strong>Project:</strong> ${estimate.ProjectName || 'N/A'}</p>
        
        <h2>Line Items</h2>
        <table>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Amount</th>
            </tr>
            ${(estimate.LineItems || []).map(item => `
            <tr>
                <td>${item.ItemDescription || ''}</td>
                <td>${item.Quantity || 0}</td>
                <td>${formatCurrency(item.UnitRate || 0)}</td>
                <td>${formatCurrency((item.Quantity || 0) * (item.UnitRate || 0))}</td>
            </tr>
            `).join('')}
        </table>
        
        <h2>Total: ${formatCurrency(estimate.TotalAmount || 0)}</h2>
    </body>
    </html>
    `;
}

// Generate PDF using PDFKit (native)
router.get('/:id/pdf-native', async (req, res) => {
    try {
        const estimateId = parseInt(req.params.id);
        console.log(`Generating native PDF for estimate ${estimateId}...`);

        // Import PDFKit and other dependencies
        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const path = require('path');

        // Get estimate data using existing query logic
        const estimateResult = await database.query(`
            SELECT e.EstimateID, e.EstimateNumber, e.EstimateDate, e.ValidUntilDate,
                   e.EstimateStatus, e.SubTotal, e.TaxRate, e.TaxAmount, e.TotalAmount, e.Notes,
                   e.ProjectID, p.ProjectName, 
                   c.CompanyName, c.ContactName, c.Phone, c.Email,
                   c.Address, c.City, c.State, c.ZipCode
            FROM Estimates e
            LEFT JOIN Projects p ON e.ProjectID = p.ProjectID
            LEFT JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE e.EstimateID = ${estimateId}
        `);

        if (estimateResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }

        const estimate = estimateResult.recordset[0];

        // Get line items
        const lineItemsResult = await database.query(`
            SELECT eli.EstimateLineItemID, eli.Quantity, eli.UnitRate, 
                   eli.ItemDescription, eli.SortOrder
            FROM EstimateLineItems eli
            WHERE eli.EstimateID = ${estimateId}
            ORDER BY eli.SortOrder, eli.EstimateLineItemID
        `);

        estimate.lineItems = lineItemsResult.recordset;

        // Generate PDF using PDFKit
        const doc = new PDFDocument({ 
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Estimate_${estimate.EstimateNumber}.pdf"`);
        
        // Pipe PDF to response
        doc.pipe(res);

        // Generate PDF content (same as standalone generator)
        // Header
        doc.fontSize(24)
           .fillColor('#2c3e50')
           .text('OMEGA BUILDERS, LLC', 50, 50);
           
        doc.fontSize(12)
           .fillColor('#7f8c8d')
           .text('Professional Design Services', 50, 80);

        // Estimate title and number
        doc.fontSize(20)
           .fillColor('#34495e')
           .text('ESTIMATE', 400, 50, { align: 'right' });
           
        doc.fontSize(14)
           .fillColor('#2c3e50')
           .text(`#${estimate.EstimateNumber}`, 400, 75, { align: 'right' });

        // Date
        doc.fontSize(10)
           .fillColor('#7f8c8d')
           .text(`Date: ${new Date().toLocaleDateString()}`, 400, 95, { align: 'right' });

        let yPos = 110;

        // Customer Information (very simplified)
        doc.fontSize(12)
           .fillColor('#2c3e50')
           .text('CUSTOMER INFORMATION', 50, yPos);
           
        yPos += 12;
        doc.fontSize(9)
           .fillColor('#34495e');

        if (estimate.CompanyName) {
            doc.text(`Customer: ${estimate.CompanyName}`, 50, yPos);
            yPos += 10;
        }

        yPos += 6;

        // Project Information (very simplified)
        if (estimate.ProjectName) {
            doc.fontSize(12)
               .fillColor('#2c3e50')
               .text('PROJECT INFORMATION', 50, yPos);
               
            yPos += 12;
            doc.fontSize(9)
               .fillColor('#34495e');

            doc.text(`Project: ${estimate.ProjectName}`, 50, yPos);
            yPos += 10;

            if (estimate.Address) {
                const address = `${estimate.Address}, ${estimate.City || ''} ${estimate.State || ''} ${estimate.ZipCode || ''}`.trim();
                doc.text(`Location: ${address}`, 50, yPos);
                yPos += 10;
            }

            yPos += 6;
        }

        // Exclusions (if any)
        if (estimate.Notes && estimate.Notes.trim()) {
            doc.fontSize(12)
               .fillColor('#2c3e50')
               .text('EXCLUSIONS', 50, yPos);
               
            yPos += 12;
            
            // Clean the notes text to remove any existing "EXCLUSIONS:" prefix
            let cleanNotes = estimate.Notes.trim();
            if (cleanNotes.startsWith('EXCLUSIONS:\n') || cleanNotes.startsWith('EXCLUSIONS:')) {
                cleanNotes = cleanNotes.replace(/^EXCLUSIONS:\s*\n?/, '').trim();
            }
            
            doc.fontSize(8)
               .fillColor('#34495e')
               .text(cleanNotes, 50, yPos, { width: 500 });
               
            yPos += Math.ceil(cleanNotes.length / 100) * 9 + 25; // Increased space even more
        }

        // Estimate Items Header
        doc.fontSize(12)
           .fillColor('#2c3e50')
           .text('ESTIMATE ITEMS', 50, yPos);
           
        yPos += 15;

        // Table header
        doc.fontSize(9)
           .fillColor('#ffffff')
           .rect(50, yPos - 3, 500, 16)
           .fill('#34495e');

        doc.fillColor('#ffffff')
           .text('DESCRIPTION', 55, yPos)
           .text('AMOUNT', 450, yPos);

        yPos += 16;

        // Line items
        let subtotal = 0;
        doc.fillColor('#2c3e50');

        estimate.lineItems.forEach((item, index) => {
            const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
            
            const description = item.ItemDescription || 'Line Item';
            const quantity = item.Quantity || 0;
            const rate = item.UnitRate || 0;
            const amount = quantity * rate;
            
            subtotal += amount;

            // Calculate row height
            const maxCharsPerLine = 70;
            const estimatedLines = Math.max(1, Math.ceil(description.length / maxCharsPerLine));
            const rowHeight = Math.max(16, estimatedLines * 10 + 6);
            
            // Draw background row
            doc.rect(50, yPos - 1, 500, rowHeight)
               .fillAndStroke(bgColor, '#ecf0f1');

            doc.fillColor('#2c3e50')
               .fontSize(8);

            // Add text
            doc.text(description, 55, yPos + 1, { 
                width: 380, 
                height: rowHeight - 2,
                align: 'left'
            });
            
            doc.text(`$${amount.toFixed(2)}`, 450, yPos + (rowHeight / 2) - 3);

            yPos += rowHeight + 1;
        });

        // Total section
        yPos += 5;
        doc.fontSize(11)
           .fillColor('#2c3e50');

        // Draw line above total
        doc.moveTo(350, yPos)
           .lineTo(550, yPos)
           .stroke('#34495e');

        yPos += 10;

        doc.fontSize(13)
           .fillColor('#2c3e50')
           .text('TOTAL:', 400, yPos)
           .text(`$${subtotal.toFixed(2)}`, 450, yPos);

        // Footer
        doc.fontSize(7)
           .fillColor('#7f8c8d')
           .text('This estimate is valid for 30 days from the date above.', 50, yPos + 25)
           .text('Thank you for considering Omega Builders, LLC for your project.', 50, yPos + 35);

        // Finalize the PDF
        doc.end();

        console.log(`✅ Native PDF generated for estimate ${estimateId}`);

    } catch (error) {
        console.error('Error generating native PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
    }
});

module.exports = router;