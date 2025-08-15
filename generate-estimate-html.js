const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');
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
            @page {
                size: A4;
                margin: 0.5in;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                margin: 0;
                color: black;
                background: white;
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .company-name {
                font-size: 24px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 5px;
            }
            .estimate-number {
                font-size: 18px;
                color: #34495e;
                margin: 10px 0;
            }
            .section {
                margin: 20px 0;
            }
            .section-title {
                font-size: 14px;
                font-weight: bold;
                color: #2c3e50;
                border-bottom: 1px solid #bdc3c7;
                padding-bottom: 5px;
                margin-bottom: 10px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
            }
            .info-item {
                margin: 5px 0;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                page-break-inside: avoid;
            }
            th, td {
                border: 1px solid #bdc3c7;
                padding: 12px 8px;
                text-align: left;
                vertical-align: top;
                line-height: 1.4;
            }
            th {
                background-color: #34495e;
                color: white;
                font-weight: bold;
                font-size: 14px;
            }
            td {
                font-size: 14px;
                min-height: 20px;
            }
            tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }
            .amount-column {
                text-align: right;
                font-weight: bold;
            }
            .total-section {
                margin-top: 20px;
                text-align: right;
            }
            .total-line {
                font-size: 16px;
                font-weight: bold;
                color: #2c3e50;
                padding: 10px 0;
                border-top: 2px solid #34495e;
                margin-top: 10px;
            }
            .exclusions {
                border: 1px solid #bdc3c7;
                padding: 15px;
                background-color: #f8f9fa;
                margin: 20px 0;
                white-space: pre-wrap;
                font-size: 14px;
                line-height: 1.5;
            }
            .footer {
                margin-top: 40px;
                font-size: 10px;
                color: #7f8c8d;
                text-align: center;
                border-top: 1px solid #bdc3c7;
                padding-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-name">OMEGA BUILDERS, LLC</div>
            <div style="color: #7f8c8d; font-size: 12px;">Professional Design Services</div>
            <div class="estimate-number">ESTIMATE #${estimate.EstimateNumber || 'N/A'}</div>
            <div style="color: #7f8c8d; font-size: 10px;">Date: ${formatDate(new Date())}</div>
        </div>

        <div class="info-grid">
            <div>
                <div class="section-title">CUSTOMER INFORMATION</div>
                ${estimate.CompanyName ? `<div class="info-item"><strong>Customer:</strong> ${estimate.CompanyName}</div>` : ''}
            </div>
            
            <div>
                ${estimate.ProjectName ? `
                <div class="section-title">PROJECT INFORMATION</div>
                <div class="info-item"><strong>Project:</strong> ${estimate.ProjectName}</div>
                ${estimate.Address ? `<div class="info-item"><strong>Location:</strong> ${estimate.Address}, ${estimate.City || ''} ${estimate.State || ''} ${estimate.ZipCode || ''}</div>` : ''}
                ` : ''}
            </div>
        </div>

        ${estimate.Notes && estimate.Notes.trim() ? `
        <div class="section">
            <div class="section-title">EXCLUSIONS</div>
            <div class="exclusions">${estimate.Notes}</div>
        </div>
        ` : ''}

        <div class="section">
            <div class="section-title">LINE ITEMS</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 70%;">DESCRIPTION</th>
                        <th style="width: 30%;">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    ${estimate.LineItems.map(item => {
                        const quantity = item.Quantity || 0;
                        const rate = item.UnitRate || 0;
                        const amount = quantity * rate;
                        return `
                        <tr>
                            <td>${item.ItemDescription || 'Line Item'}</td>
                            <td class="amount-column">${formatCurrency(amount)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="total-section">
            <div class="total-line">
                TOTAL: ${formatCurrency(estimate.TotalAmount || 0)}
            </div>
        </div>

        <div class="footer">
            This estimate is valid for 30 days from the date above.<br>
            Thank you for considering Omega Builders, LLC for your project.
        </div>
    </body>
    </html>
    `;
}

async function getEstimateData(estimateId) {
    try {
        console.log(`📋 Fetching estimate data for ID: ${estimateId}`);
        
        // Connect to database
        await database.connect();
        console.log('✅ Database connected');

        // Get estimate details (using the same query structure as the working generator)
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
            throw new Error(`No estimate found with ID ${estimateId}`);
        }

        const estimate = estimateResult.recordset[0];
        console.log(`📄 Found estimate: ${estimate.EstimateNumber}`);

        // Get line items (using the correct structure from working generator)
        const lineItemsResult = await database.query(`
            SELECT eli.EstimateLineItemID, eli.Quantity, eli.UnitRate, 
                   eli.ItemDescription, eli.SortOrder
            FROM EstimateLineItems eli
            WHERE eli.EstimateID = @estimateId
            ORDER BY eli.SortOrder, eli.EstimateLineItemID
        `, { estimateId });

        estimate.LineItems = lineItemsResult.recordset;
        console.log(`📝 Found ${estimate.LineItems.length} line items`);

        await database.close();
        return estimate;

    } catch (error) {
        console.error('❌ Database error:', error);
        await database.close();
        throw error;
    }
}

async function askForSaveLocation() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        console.log('\n📁 Choose where to save the HTML file:');
        console.log('1. Desktop');
        console.log('2. Documents');
        console.log('3. Downloads');
        console.log('4. Current folder (ArchitectureApp)');
        console.log('5. Custom path');

        rl.question('\nEnter your choice (1-5): ', (choice) => {
            const userProfile = process.env.USERPROFILE || process.env.HOME;
            let savePath;

            switch(choice) {
                case '1':
                    savePath = path.join(userProfile, 'Desktop');
                    break;
                case '2':
                    savePath = path.join(userProfile, 'Documents');
                    break;
                case '3':
                    savePath = path.join(userProfile, 'Downloads');
                    break;
                case '4':
                    savePath = process.cwd();
                    break;
                case '5':
                    rl.question('Enter full path: ', (customPath) => {
                        rl.close();
                        resolve(customPath);
                    });
                    return;
                default:
                    console.log('Invalid choice, using Desktop');
                    savePath = path.join(userProfile, 'Desktop');
            }

            rl.close();
            resolve(savePath);
        });
    });
}

async function main() {
    try {
        // Get estimate ID from command line
        const estimateId = process.argv[2];
        if (!estimateId) {
            console.log('Usage: node generate-estimate-html.js <estimateId>');
            process.exit(1);
        }

        console.log('🌐 HTML Estimate Generator (Adobe Acrobat Compatible)');
        console.log('====================================================');

        // Get estimate data
        const estimate = await getEstimateData(estimateId);
        
        // Ask where to save
        const saveDir = await askForSaveLocation();
        
        // Create filename
        const customerName = estimate.CompanyName || 'Customer';
        const cleanCustomerName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Estimate_${estimate.EstimateNumber}_${cleanCustomerName}.html`;
        const outputPath = path.join(saveDir, filename);

        console.log(`\n💾 Saving HTML to: ${outputPath}`);

        // Generate HTML
        const html = generateEstimatePdfHtml(estimate);
        fs.writeFileSync(outputPath, html, 'utf8');

        console.log(`\n✅ HTML file generated successfully!`);
        console.log(`📄 File: ${filename}`);
        console.log(`📁 Location: ${saveDir}`);
        
        // Get file size
        const stats = fs.statSync(outputPath);
        console.log(`📊 Size: ${(stats.size / 1024).toFixed(1)} KB`);

        console.log(`\n📋 Next Steps for Adobe Acrobat PDF:`);
        console.log(`1. The HTML file will open in your browser`);
        console.log(`2. Press Ctrl+P to print`);
        console.log(`3. Select "Microsoft Print to PDF" or "Adobe PDF"`);
        console.log(`4. Choose where to save your PDF`);

        // Ask if user wants to open the HTML
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('\n🔍 Would you like to open the HTML file now? (y/n): ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                exec(`start "" "${outputPath}"`, (error) => {
                    if (error) {
                        console.log('❌ Could not open HTML automatically');
                    } else {
                        console.log('🌐 HTML file opened in browser!');
                        console.log('📤 Use Ctrl+P to print to PDF via Adobe Acrobat');
                    }
                });
            }
            console.log('\n🎉 Done!');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
