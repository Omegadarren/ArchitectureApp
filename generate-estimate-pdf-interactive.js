const puppeteer = require('puppeteer');
const database = require('./config/database');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Function to ask user for save location
function askForSaveLocation(defaultFileName) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        console.log('\n📁 WHERE TO SAVE THE PDF?');
        console.log('==========================');
        console.log('1. Desktop (recommended)');
        console.log('2. Documents folder');
        console.log('3. Current folder');
        console.log('4. Custom path');
        console.log('');
        
        rl.question('Enter your choice (1-4) or press Enter for Desktop: ', (answer) => {
            const choice = answer.trim() || '1';
            let savePath = '';
            
            switch (choice) {
                case '1':
                    savePath = path.join(require('os').homedir(), 'Desktop', defaultFileName);
                    break;
                case '2':
                    savePath = path.join(require('os').homedir(), 'Documents', defaultFileName);
                    break;
                case '3':
                    savePath = path.join(process.cwd(), defaultFileName);
                    break;
                case '4':
                    rl.question('Enter full path (including filename): ', (customPath) => {
                        if (!customPath.trim()) {
                            savePath = path.join(require('os').homedir(), 'Desktop', defaultFileName);
                        } else {
                            savePath = customPath.trim();
                            if (!savePath.toLowerCase().endsWith('.pdf')) {
                                savePath += '.pdf';
                            }
                        }
                        rl.close();
                        resolve(savePath);
                    });
                    return;
                default:
                    savePath = path.join(require('os').homedir(), 'Desktop', defaultFileName);
                    break;
            }
            
            rl.close();
            resolve(savePath);
        });
    });
}

async function generateEstimatePdf(estimateId) {
    try {
        console.log('🎯 OMEGA BUILDERS PDF GENERATOR');
        console.log('================================');
        console.log(`Generating PDF for estimate ${estimateId}...`);
        
        // Connect to database
        console.log('📊 Connecting to database...');
        await database.connect();
        
        // Get estimate data
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

        console.log(`✅ Loaded estimate with ${estimate.LineItems.length} line items`);
        console.log(`📋 ${estimate.EstimateNumber} - ${estimate.CompanyName}`);
        console.log(`💰 Total: ${new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(estimate.TotalAmount)}`);

        // Ask where to save
        const defaultFileName = `Estimate_${estimate.EstimateNumber}_${estimate.CompanyName || 'Customer'}.pdf`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const selectedPath = await askForSaveLocation(defaultFileName);
        
        console.log(`\n📁 Saving to: ${selectedPath}`);

        // Generate PDF
        console.log('🔄 Generating PDF...');
        const pdfHtml = generateEstimatePdfHtml(estimate);
        
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
        
        // Ensure directory exists
        const directory = path.dirname(selectedPath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        
        // Save PDF
        fs.writeFileSync(selectedPath, pdfBuffer);
        
        await database.close();
        
        return { 
            success: true, 
            filePath: selectedPath,
            fileName: path.basename(selectedPath),
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

// Get estimate ID from command line
const estimateId = process.argv[2] || 2;

// Run PDF generation
generateEstimatePdf(parseInt(estimateId)).then(result => {
    console.log('\n' + '='.repeat(40));
    if (result.success) {
        console.log('✅ SUCCESS! PDF Generated');
        console.log(`📄 File: ${result.fileName}`);
        console.log(`📁 Location: ${result.filePath}`);
        console.log(`📊 Size: ${(result.size / 1024).toFixed(1)} KB`);
        console.log(`💰 Total: $${result.estimate.total}`);
        console.log(`👤 Customer: ${result.estimate.customer}`);
    } else {
        console.log('❌ FAILED:', result.error);
    }
    console.log('='.repeat(40));
    process.exit(result.success ? 0 : 1);
});
