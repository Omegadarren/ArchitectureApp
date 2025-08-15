// PDF Generator Module
const puppeteer = require('puppeteer');
const database = require('./config/database');
const fs = require('fs');
const path = require('path');

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
            h1 { color: black; margin-bottom: 5px; }
            h2 { color: black; margin: 20px 0 10px 0; }
            p { color: black; margin: 5px 0; }
            table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 10px 0;
            }
            th, td { 
                border: 1px solid black; 
                padding: 8px; 
                text-align: left;
            }
            th { 
                background-color: #f0f0f0; 
                font-weight: bold;
            }
            .currency { text-align: right; }
            .total { 
                font-size: 16px; 
                font-weight: bold; 
                text-align: right; 
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <h1>Omega Builders, LLC</h1>
        <p>Professional Design Services</p>
        
        <h2>ESTIMATE ${estimate.EstimateNumber || 'N/A'}</h2>
        
        <table style="margin-bottom: 20px; border: none;">
            <tr style="border: none;">
                <td style="border: none; width: 50%;">
                    <strong>Date:</strong> ${formatDate(estimate.EstimateDate)}<br>
                    <strong>Valid Until:</strong> ${formatDate(estimate.ValidUntilDate)}<br>
                    <strong>Status:</strong> ${estimate.EstimateStatus || 'Draft'}
                </td>
                <td style="border: none; width: 50%;">
                    <strong>Customer:</strong><br>
                    ${estimate.CompanyName || 'N/A'}<br>
                    ${estimate.ContactName ? estimate.ContactName + '<br>' : ''}
                    ${estimate.Address ? estimate.Address + '<br>' : ''}
                    ${estimate.City ? estimate.City + ', ' : ''}${estimate.State || ''} ${estimate.ZipCode || ''}<br>
                    ${estimate.Phone ? 'Phone: ' + estimate.Phone + '<br>' : ''}
                    ${estimate.Email ? 'Email: ' + estimate.Email : ''}
                </td>
            </tr>
        </table>
        
        <p><strong>Project:</strong> ${estimate.ProjectName || 'N/A'}</p>
        
        <h2>Line Items</h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 60%;">Description</th>
                    <th style="width: 15%;">Quantity</th>
                    <th style="width: 15%;">Rate</th>
                    <th style="width: 15%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${(estimate.LineItems || []).map(item => `
                <tr>
                    <td>${item.ItemDescription || ''}</td>
                    <td style="text-align: center;">${item.Quantity || 0}</td>
                    <td class="currency">${formatCurrency(item.UnitRate || 0)}</td>
                    <td class="currency">${formatCurrency((item.Quantity || 0) * (item.UnitRate || 0))}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <table style="width: 50%; margin-left: auto; margin-top: 20px;">
            <tr>
                <td style="text-align: right; padding: 5px;"><strong>Subtotal:</strong></td>
                <td class="currency" style="padding: 5px;">${formatCurrency(estimate.SubTotal || 0)}</td>
            </tr>
            <tr>
                <td style="text-align: right; padding: 5px;"><strong>Tax (${((estimate.TaxRate || 0) * 100).toFixed(2)}%):</strong></td>
                <td class="currency" style="padding: 5px;">${formatCurrency(estimate.TaxAmount || 0)}</td>
            </tr>
            <tr style="background-color: #f0f0f0;">
                <td style="text-align: right; padding: 5px;"><strong>Total:</strong></td>
                <td class="currency" style="padding: 5px; font-weight: bold; font-size: 16px;">${formatCurrency(estimate.TotalAmount || 0)}</td>
            </tr>
        </table>
        
        ${estimate.Notes ? `
        <h2>Notes</h2>
        <div style="border: 1px solid #ccc; padding: 10px; background-color: #f9f9f9;">
            ${estimate.Notes.split('\n').map(line => `<p style="margin: 5px 0;">${line}</p>`).join('')}
        </div>
        ` : ''}
    </body>
    </html>
    `;
}

async function generatePdfToFile(estimateId) {
    try {
        console.log(`Generating PDF for estimate ${estimateId}...`);
        
        // Get estimate data from database
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
            throw new Error('Estimate not found');
        }

        const lineItemsResult = await database.query(`
            SELECT eli.EstimateLineItemID, eli.Quantity, eli.UnitRate, 
                   eli.ItemDescription, eli.SortOrder
            FROM EstimateLineItems eli
            WHERE eli.EstimateID = @estimateId
            ORDER BY eli.SortOrder, eli.EstimateLineItemID
        `, { estimateId });

        const estimate = estimateResult.recordset[0];
        estimate.LineItems = lineItemsResult.recordset;

        // Generate HTML
        const pdfHtml = generateEstimatePdfHtml(estimate);

        // Generate PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setContent(pdfHtml);
        await new Promise(resolve => setTimeout(resolve, 1000));

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

        // Save to public folder with timestamp to avoid caching
        const timestamp = Date.now();
        const filename = `estimate_${estimate.EstimateNumber}_${timestamp}.pdf`;
        const filepath = path.join(__dirname, 'public', filename);
        
        fs.writeFileSync(filepath, pdfBuffer);

        console.log(`PDF saved as: ${filename}`);
        
        return {
            success: true,
            filename: filename,
            size: pdfBuffer.length,
            downloadUrl: `/${filename}`
        };

    } catch (error) {
        console.error('PDF generation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    generatePdfToFile
};
