const puppeteer = require('puppeteer');
const database = require('./config/database');

// Helper function to generate HTML for PDF (same as in estimates.js)
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

async function generateEstimatePdf(estimateId) {
    try {
        console.log(`Generating PDF for estimate ${estimateId}...`);
        
        // Connect to database
        console.log('Connecting to database...');
        await database.connect();
        
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
            throw new Error('Estimate not found');
        }

        // Get line items for this estimate
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
        console.log('Estimate details:', {
            number: estimate.EstimateNumber,
            customer: estimate.CompanyName,
            project: estimate.ProjectName,
            total: estimate.TotalAmount
        });

        // Generate HTML for the PDF
        const pdfHtml = generateEstimatePdfHtml(estimate);
        console.log('Generated HTML length:', pdfHtml.length);

        // Launch Puppeteer and generate PDF
        console.log('Launching Puppeteer...');
        const browser = await puppeteer.launch({
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
        
        // Give it time to render
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
        
        // Save the PDF to file
        const fs = require('fs');
        const filename = `Estimate_${estimate.EstimateNumber}_${estimate.CompanyName || 'Customer'}.pdf`.replace(/[^a-zA-Z0-9_-]/g, '_');
        fs.writeFileSync(filename, pdfBuffer);
        
        console.log(`✅ PDF saved as: ${filename}`);
        console.log(`File size: ${fs.statSync(filename).size} bytes`);
        
        // Close database connection
        await database.close();
        
        return { 
            success: true, 
            filename, 
            size: pdfBuffer.length,
            estimate: {
                number: estimate.EstimateNumber,
                customer: estimate.CompanyName,
                total: estimate.TotalAmount
            }
        };
        
    } catch (error) {
        console.error('❌ PDF generation failed:', error);
        await database.close();
        return { success: false, error: error.message };
    }
}

// Get estimate ID from command line argument or use default
const estimateId = process.argv[2] || 2;

console.log(`Starting PDF generation for estimate ID: ${estimateId}`);
console.log('Usage: node generate-estimate-pdf.js [estimateId]');
console.log('---');

// Run the PDF generation
generateEstimatePdf(parseInt(estimateId)).then(result => {
    console.log('---');
    console.log('Final result:', result);
    process.exit(result.success ? 0 : 1);
});
