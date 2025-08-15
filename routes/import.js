const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const database = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const extension = path.extname(file.originalname);
        cb(null, `import_${timestamp}${extension}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(extension)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Upload and preview Excel file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const filePath = req.file.path;
        const workbook = xlsx.readFile(filePath);
        const sheetNames = workbook.SheetNames;
        
        // Get preview of first sheet (first 10 rows)
        const firstSheet = workbook.Sheets[sheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });
        const preview = jsonData.slice(0, 11); // Header + 10 rows
        
        // Get headers for mapping
        const headers = preview.length > 0 ? preview[0] : [];
        
        res.json({
            filename: req.file.filename,
            originalName: req.file.originalname,
            sheetNames: sheetNames,
            headers: headers,
            preview: preview,
            totalRows: jsonData.length - 1 // Exclude header
        });
    } catch (error) {
        console.error('Error processing uploaded file:', error);
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to process uploaded file' });
    }
});

// Import customers from Excel
router.post('/customers', async (req, res) => {
    try {
        const { filename, sheetName, mapping, startRow } = req.body;
        
        if (!filename || !mapping) {
            return res.status(400).json({ error: 'Filename and field mapping are required' });
        }
        
        const filePath = path.join(__dirname, '../uploads', filename);
        if (!fs.existsSync(filePath)) {
            return res.status(400).json({ error: 'File not found' });
        }
        
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };
        
        // Start from specified row (default to row 2 to skip headers)
        const dataStartRow = startRow || 1;
        
        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            try {
                // Map Excel columns to database fields
                const customerData = {
                    companyName: getColumnValue(row, mapping.companyName),
                    contactName: getColumnValue(row, mapping.contactName),
                    phone: getColumnValue(row, mapping.phone),
                    email: getColumnValue(row, mapping.email),
                    address: getColumnValue(row, mapping.address),
                    city: getColumnValue(row, mapping.city),
                    state: getColumnValue(row, mapping.state),
                    zipCode: getColumnValue(row, mapping.zipCode)
                };
                
                // Skip rows without company name
                if (!customerData.companyName) {
                    results.skipped++;
                    continue;
                }
                
                // Check if customer already exists
                const existingCustomer = await database.query(`
                    SELECT CustomerID FROM Customers WHERE CompanyName = @companyName
                `, { companyName: customerData.companyName });
                
                if (existingCustomer.recordset.length > 0) {
                    results.skipped++;
                    continue;
                }
                
                // Insert customer
                await database.query(`
                    INSERT INTO Customers (CompanyName, ContactName, Phone, Email, Address, City, State, ZipCode)
                    VALUES (@companyName, @contactName, @phone, @email, @address, @city, @state, @zipCode)
                `, customerData);
                
                results.imported++;
                
            } catch (error) {
                results.errors.push({
                    row: i + 1,
                    error: error.message
                });
            }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json(results);
    } catch (error) {
        console.error('Error importing customers:', error);
        res.status(500).json({ error: 'Failed to import customers' });
    }
});

// Import projects from Excel
router.post('/projects', async (req, res) => {
    try {
        const { filename, sheetName, mapping, startRow } = req.body;
        
        if (!filename || !mapping) {
            return res.status(400).json({ error: 'Filename and field mapping are required' });
        }
        
        const filePath = path.join(__dirname, '../uploads', filename);
        if (!fs.existsSync(filePath)) {
            return res.status(400).json({ error: 'File not found' });
        }
        
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };
        
        const dataStartRow = startRow || 1;
        
        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            try {
                const projectName = getColumnValue(row, mapping.projectName);
                const customerName = getColumnValue(row, mapping.customerName);
                
                if (!projectName || !customerName) {
                    results.skipped++;
                    continue;
                }
                
                // Find customer ID
                const customerResult = await database.query(`
                    SELECT CustomerID FROM Customers WHERE CompanyName = @companyName
                `, { companyName: customerName });
                
                if (customerResult.recordset.length === 0) {
                    results.errors.push({
                        row: i + 1,
                        error: `Customer '${customerName}' not found`
                    });
                    continue;
                }
                
                const customerId = customerResult.recordset[0].CustomerID;
                
                // Map Excel columns to database fields
                const projectData = {
                    customerId: customerId,
                    projectName: projectName,
                    projectDescription: getColumnValue(row, mapping.projectDescription),
                    projectAddress: getColumnValue(row, mapping.projectAddress),
                    projectCity: getColumnValue(row, mapping.projectCity),
                    projectState: getColumnValue(row, mapping.projectState),
                    projectZip: getColumnValue(row, mapping.projectZip),
                    startDate: parseDate(getColumnValue(row, mapping.startDate)),
                    estimatedCompletionDate: parseDate(getColumnValue(row, mapping.estimatedCompletionDate)),
                    projectStatus: getColumnValue(row, mapping.projectStatus) || 'Planning',
                    totalContractAmount: parseFloat(getColumnValue(row, mapping.totalContractAmount)) || null
                };
                
                // Insert project
                await database.query(`
                    INSERT INTO Projects (CustomerID, ProjectName, ProjectDescription, ProjectAddress, 
                                        ProjectCity, ProjectState, ProjectZip, StartDate, 
                                        EstimatedCompletionDate, ProjectStatus, TotalContractAmount)
                    VALUES (@customerId, @projectName, @projectDescription, @projectAddress, 
                            @projectCity, @projectState, @projectZip, @startDate, 
                            @estimatedCompletionDate, @projectStatus, @totalContractAmount)
                `, projectData);
                
                results.imported++;
                
            } catch (error) {
                results.errors.push({
                    row: i + 1,
                    error: error.message
                });
            }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json(results);
    } catch (error) {
        console.error('Error importing projects:', error);
        res.status(500).json({ error: 'Failed to import projects' });
    }
});

// Import line items from Excel
router.post('/line-items', async (req, res) => {
    try {
        const { filename, sheetName, mapping, startRow } = req.body;
        
        if (!filename || !mapping) {
            return res.status(400).json({ error: 'Filename and field mapping are required' });
        }
        
        const filePath = path.join(__dirname, '../uploads', filename);
        if (!fs.existsSync(filePath)) {
            return res.status(400).json({ error: 'File not found' });
        }
        
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };
        
        const dataStartRow = startRow || 1;
        
        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            try {
                // Map Excel columns to database fields
                const lineItemData = {
                    itemCode: getColumnValue(row, mapping.itemCode),
                    itemName: getColumnValue(row, mapping.itemName),
                    itemDescription: getColumnValue(row, mapping.itemDescription),
                    category: getColumnValue(row, mapping.category),
                    unitOfMeasure: getColumnValue(row, mapping.unitOfMeasure),
                    standardRate: parseFloat(getColumnValue(row, mapping.standardRate)) || 0
                };
                
                // Skip rows without item name
                if (!lineItemData.itemName) {
                    results.skipped++;
                    continue;
                }
                
                // Check if line item already exists
                if (lineItemData.itemCode) {
                    const existingItem = await database.query(`
                        SELECT LineItemID FROM LineItemsMaster WHERE ItemCode = @itemCode
                    `, { itemCode: lineItemData.itemCode });
                    
                    if (existingItem.recordset.length > 0) {
                        results.skipped++;
                        continue;
                    }
                }
                
                // Insert line item
                await database.query(`
                    INSERT INTO LineItemsMaster (ItemCode, ItemName, ItemDescription, Category, UnitOfMeasure, StandardRate)
                    VALUES (@itemCode, @itemName, @itemDescription, @category, @unitOfMeasure, @standardRate)
                `, lineItemData);
                
                results.imported++;
                
            } catch (error) {
                results.errors.push({
                    row: i + 1,
                    error: error.message
                });
            }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json(results);
    } catch (error) {
        console.error('Error importing line items:', error);
        res.status(500).json({ error: 'Failed to import line items' });
    }
});

// Get available import templates
router.get('/templates', (req, res) => {
    const templates = {
        customers: {
            name: 'Customers Template',
            fields: {
                companyName: { required: true, description: 'Company/Business Name' },
                contactName: { required: false, description: 'Primary Contact Person' },
                phone: { required: false, description: 'Phone Number' },
                email: { required: false, description: 'Email Address' },
                address: { required: false, description: 'Street Address' },
                city: { required: false, description: 'City' },
                state: { required: false, description: 'State/Province' },
                zipCode: { required: false, description: 'ZIP/Postal Code' }
            }
        },
        projects: {
            name: 'Projects Template',
            fields: {
                customerName: { required: true, description: 'Customer Company Name (must exist in customers table)' },
                projectName: { required: true, description: 'Project Name' },
                projectDescription: { required: false, description: 'Project Description' },
                projectAddress: { required: false, description: 'Project Address' },
                projectCity: { required: false, description: 'Project City' },
                projectState: { required: false, description: 'Project State' },
                projectZip: { required: false, description: 'Project ZIP Code' },
                startDate: { required: false, description: 'Start Date (MM/DD/YYYY)' },
                estimatedCompletionDate: { required: false, description: 'Estimated Completion Date (MM/DD/YYYY)' },
                projectStatus: { required: false, description: 'Status (Planning, In Progress, Completed, On Hold)' },
                totalContractAmount: { required: false, description: 'Total Contract Amount' }
            }
        },
        lineItems: {
            name: 'Line Items Template',
            fields: {
                itemCode: { required: false, description: 'Unique Item Code' },
                itemName: { required: true, description: 'Item Name' },
                itemDescription: { required: false, description: 'Item Description' },
                category: { required: false, description: 'Category (Design, Permits, Construction, etc.)' },
                unitOfMeasure: { required: false, description: 'Unit of Measure (sq ft, hour, each, etc.)' },
                standardRate: { required: false, description: 'Standard Rate/Price' }
            }
        }
    };
    
    res.json(templates);
});

// Generate sample Excel template
router.get('/templates/:type/download', (req, res) => {
    try {
        const { type } = req.params;
        
        let sampleData = [];
        let filename = '';
        
        switch (type) {
            case 'customers':
                filename = 'customers_template.xlsx';
                sampleData = [
                    ['Company Name', 'Contact Name', 'Phone', 'Email', 'Address', 'City', 'State', 'ZIP Code'],
                    ['Acme Construction', 'John Smith', '555-123-4567', 'john@acme.com', '123 Main St', 'Anytown', 'CA', '12345'],
                    ['Smith Builders', 'Jane Doe', '555-987-6543', 'jane@smith.com', '456 Oak Ave', 'Another City', 'TX', '67890']
                ];
                break;
                
            case 'projects':
                filename = 'projects_template.xlsx';
                sampleData = [
                    ['Customer Name', 'Project Name', 'Description', 'Address', 'City', 'State', 'ZIP', 'Start Date', 'Est. Completion', 'Status', 'Contract Amount'],
                    ['Acme Construction', 'Office Building Renovation', 'Complete renovation of 3-story office building', '789 Business Blvd', 'Downtown', 'CA', '12345', '1/15/2024', '6/30/2024', 'In Progress', '250000'],
                    ['Smith Builders', 'Residential Addition', 'Two-story addition to existing home', '321 Elm St', 'Suburbia', 'TX', '67890', '3/1/2024', '8/15/2024', 'Planning', '150000']
                ];
                break;
                
            case 'line-items':
                filename = 'line_items_template.xlsx';
                sampleData = [
                    ['Item Code', 'Item Name', 'Description', 'Category', 'Unit of Measure', 'Standard Rate'],
                    ['DESIGN-001', 'Architectural Design - Residential', 'Complete architectural design services for residential projects', 'Design', 'hour', '115'],
                    ['PERMIT-001', 'Building Permit Application', 'Preparation and submission of building permit application', 'Permits', 'each', '1500.00'],
                    ['CONSULT-001', 'Project Consultation', 'General project consultation and advisory services', 'Consultation', 'hour', '125.00']
                ];
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid template type' });
        }
        
        // Create workbook and worksheet
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.aoa_to_sheet(sampleData);
        
        // Add some styling (make header bold)
        const range = xlsx.utils.decode_range(worksheet['!ref']);
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
            if (!worksheet[cellAddress]) continue;
            worksheet[cellAddress].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "CCCCCC" } }
            };
        }
        
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');
        
        // Generate buffer
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Clean up old uploaded files (utility endpoint)
router.delete('/cleanup', async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            return res.json({ message: 'No uploads directory found', deletedCount: 0 });
        }
        
        const files = fs.readdirSync(uploadsDir);
        
        let deletedCount = 0;
        const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour ago
        
        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            
            // Delete files older than 1 hour
            if (stats.mtimeMs < oneHourAgo) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });
        
        res.json({ 
            message: `Cleaned up ${deletedCount} old files`,
            deletedCount 
        });
    } catch (error) {
        console.error('Error cleaning up files:', error);
        res.status(500).json({ error: 'Failed to cleanup files' });
    }
});

// Bulk import using predefined mapping (for advanced users)
router.post('/bulk-import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { importType, mapping } = req.body;
        
        if (!importType || !mapping) {
            return res.status(400).json({ error: 'Import type and mapping are required' });
        }
        
        const parsedMapping = JSON.parse(mapping);
        
        // Process the file based on import type
        const importData = {
            filename: req.file.filename,
            sheetName: null,
            mapping: parsedMapping,
            startRow: 1
        };
        
        let result;
        switch (importType) {
            case 'customers':
                result = await processCustomerImport(importData);
                break;
            case 'projects':
                result = await processProjectImport(importData);
                break;
            case 'line-items':
                result = await processLineItemImport(importData);
                break;
            default:
                return res.status(400).json({ error: 'Invalid import type' });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error in bulk import:', error);
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to process bulk import' });
    }
});

// Helper functions
function getColumnValue(row, columnIndex) {
    if (columnIndex === null || columnIndex === undefined || columnIndex === '') {
        return null;
    }
    
    const value = row[parseInt(columnIndex)];
    return value !== undefined && value !== null && value !== '' ? String(value).trim() : null;
}

function parseDate(dateValue) {
    if (!dateValue) return null;
    
    // Handle Excel date numbers
    if (typeof dateValue === 'number') {
        const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
        return excelDate.toISOString().split('T')[0];
    }
    
    // Handle string dates
    if (typeof dateValue === 'string') {
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
        }
    }
    
    return null;
}

// Additional helper functions for bulk import
async function processCustomerImport(importData) {
    // Implementation similar to POST /customers but adapted for bulk processing
    // This would use the same logic but with the uploaded file
    const filePath = path.join(__dirname, '../uploads', importData.filename);
    
    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[importData.sheetName || workbook.SheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        const results = { imported: 0, skipped: 0, errors: [] };
        
        for (let i = importData.startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            try {
                const customerData = {
                    companyName: getColumnValue(row, importData.mapping.companyName),
                    contactName: getColumnValue(row, importData.mapping.contactName),
                    phone: getColumnValue(row, importData.mapping.phone),
                    email: getColumnValue(row, importData.mapping.email),
                    address: getColumnValue(row, importData.mapping.address),
                    city: getColumnValue(row, importData.mapping.city),
                    state: getColumnValue(row, importData.mapping.state),
                    zipCode: getColumnValue(row, importData.mapping.zipCode)
                };
                
                if (!customerData.companyName) {
                    results.skipped++;
                    continue;
                }
                
                const existingCustomer = await database.query(`
                    SELECT CustomerID FROM Customers WHERE CompanyName = @companyName
                `, { companyName: customerData.companyName });
                
                if (existingCustomer.recordset.length > 0) {
                    results.skipped++;
                    continue;
                }
                
                await database.query(`
                    INSERT INTO Customers (CompanyName, ContactName, Phone, Email, Address, City, State, ZipCode)
                    VALUES (@companyName, @contactName, @phone, @email, @address, @city, @state, @zipCode)
                `, customerData);
                
                results.imported++;
                
            } catch (error) {
                results.errors.push({
                    row: i + 1,
                    error: error.message
                });
            }
        }
        
        return results;
    } finally {
        // Clean up file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

async function processProjectImport(importData) {
    // Similar implementation for projects
    // Implementation would follow the same pattern as customer import
    return { imported: 0, skipped: 0, errors: [], message: 'Project import not yet implemented in bulk mode' };
}

async function processLineItemImport(importData) {
    // Similar implementation for line items
    // Implementation would follow the same pattern as customer import
    return { imported: 0, skipped: 0, errors: [], message: 'Line item import not yet implemented in bulk mode' };
}

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    
    if (error.message === 'Only Excel (.xlsx, .xls) and CSV files are allowed') {
        return res.status(400).json({ error: error.message });
    }
    
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
});

module.exports = router;