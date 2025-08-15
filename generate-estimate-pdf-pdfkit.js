const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');
const database = require('./config/database');

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

        estimate.lineItems = lineItemsResult.recordset;
        console.log(`📝 Found ${estimate.lineItems.length} line items`);

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
        console.log('\n📁 Choose where to save the PDF:');
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

function generatePDF(estimate, outputPath) {
    return new Promise((resolve, reject) => {
        console.log('🎨 Creating PDF with PDFKit...');
        
        // Create a new PDF document
        const doc = new PDFDocument({ 
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Pipe to file
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

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

        // Exclusions (if any) - Use Notes field (very compact)
        if (estimate.Notes && estimate.Notes.trim()) {
            doc.fontSize(12)
               .fillColor('#2c3e50')
               .text('EXCLUSIONS', 50, yPos);
               
            yPos += 12;
            doc.fontSize(8)
               .fillColor('#34495e')
               .text(estimate.Notes, 50, yPos, { width: 500 });
               
            yPos += Math.ceil(estimate.Notes.length / 100) * 9 + 8;
        }

        // Line Items Header (very compact)
        doc.fontSize(12)
           .fillColor('#2c3e50')
           .text('LINE ITEMS', 50, yPos);
           
        yPos += 15;

        // Table header (smaller)
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

            // Calculate how many lines the description will need (more compact)
            const maxCharsPerLine = 70; // More characters per line
            const estimatedLines = Math.max(1, Math.ceil(description.length / maxCharsPerLine));
            const rowHeight = Math.max(16, estimatedLines * 10 + 6); // Smaller minimum height and line spacing
            
            // Draw background row with dynamic height
            doc.rect(50, yPos - 1, 500, rowHeight)
               .fillAndStroke(bgColor, '#ecf0f1');

            doc.fillColor('#2c3e50')
               .fontSize(8); // Smaller font

            // Add text to the row with proper wrapping
            doc.text(description, 55, yPos + 1, { 
                width: 380, 
                height: rowHeight - 2,
                align: 'left'
            });
            
            // Position amount text in the middle of the row
            doc.text(`$${amount.toFixed(2)}`, 450, yPos + (rowHeight / 2) - 3);

            yPos += rowHeight + 1; // Smaller gap between rows

            // Check if we need a new page (more generous page limit)
            if (yPos > 720) {
                doc.addPage();
                yPos = 50;
                
                // Re-add table header on new page (smaller)
                doc.fontSize(9)
                   .fillColor('#ffffff')
                   .rect(50, yPos - 3, 500, 16)
                   .fill('#34495e');

                doc.fillColor('#ffffff')
                   .text('DESCRIPTION', 55, yPos)
                   .text('AMOUNT', 450, yPos);

                yPos += 18;
            }
        });

        // Total section (more compact)
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

        // Footer (very compact)
        doc.fontSize(7)
           .fillColor('#7f8c8d')
           .text('This estimate is valid for 30 days from the date above.', 50, yPos + 25)
           .text('Thank you for considering Omega Builders, LLC for your project.', 50, yPos + 35);

        // Finalize the PDF
        doc.end();

        stream.on('finish', () => {
            resolve(outputPath);
        });

        stream.on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    try {
        // Get estimate ID from command line
        const estimateId = process.argv[2];
        if (!estimateId) {
            console.log('Usage: node generate-estimate-pdf-pdfkit.js <estimateId>');
            process.exit(1);
        }

        console.log('🚀 PDFKit Estimate Generator');
        console.log('============================');

        // Get estimate data
        const estimate = await getEstimateData(estimateId);
        
        // Ask where to save
        const saveDir = await askForSaveLocation();
        
        // Create filename
        const customerName = estimate.CompanyName || 'Customer';
        const cleanCustomerName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Estimate_${estimate.EstimateNumber}_${cleanCustomerName}.pdf`;
        const outputPath = path.join(saveDir, filename);

        console.log(`\n💾 Saving to: ${outputPath}`);

        // Generate PDF
        await generatePDF(estimate, outputPath);

        console.log(`\n✅ PDF generated successfully!`);
        console.log(`📄 File: ${filename}`);
        console.log(`📁 Location: ${saveDir}`);
        
        // Get file size
        const stats = fs.statSync(outputPath);
        console.log(`📊 Size: ${(stats.size / 1024).toFixed(1)} KB`);

        // Ask if user wants to open the PDF
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('\n🔍 Would you like to open the PDF now? (y/n): ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                exec(`start "" "${outputPath}"`, (error) => {
                    if (error) {
                        console.log('❌ Could not open PDF automatically');
                    } else {
                        console.log('📂 PDF opened!');
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
