const fs = require('fs');
const path = require('path');

// Configuration for different database connections
const azureConfig = {
    server: process.env.AZURE_DB_SERVER,
    database: process.env.AZURE_DB_DATABASE,
    user: process.env.AZURE_DB_USERNAME,
    password: process.env.AZURE_DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

const postgresConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Table mapping: Azure SQL (camelCase) -> PostgreSQL (snake_case)
const tableMapping = {
    'Users': {
        pgTable: 'users',
        columnMap: {
            'UserID': 'user_id',
            'Username': 'username',
            'Password': 'password',
            'FirstName': 'first_name',
            'LastName': 'last_name',
            'Email': 'email',
            'CreatedDate': 'created_date'
        }
    },
    'Customers': {
        pgTable: 'customers',
        columnMap: {
            'CustomerID': 'customer_id',
            'FirstName': 'first_name',
            'LastName': 'last_name',
            'CompanyName': 'company_name',
            'ContactName': 'contact_name',
            'Email': 'email',
            'Phone': 'phone',
            'ContactName2': 'contact_name2',
            'Email2': 'email2',
            'Phone2': 'phone2',
            'Address': 'address',
            'City': 'city',
            'State': 'state',
            'ZipCode': 'zip_code',
            'Status': 'status',
            'CreatedDate': 'created_date'
        }
    },
    'Projects': {
        pgTable: 'projects',
        columnMap: {
            'ProjectID': 'project_id',
            'CustomerID': 'customer_id',
            'ProjectName': 'project_name',
            'ProjectDescription': 'project_description',
            'ProjectContactName': 'project_contact_name',
            'ProjectContactPhone': 'project_contact_phone',
            'ProjectContactEmail': 'project_contact_email',
            'ProjectAddress': 'project_address',
            'ProjectCity': 'project_city',
            'ProjectState': 'project_state',
            'ProjectZip': 'project_zip',
            'StartDate': 'start_date',
            'EstimatedCompletionDate': 'estimated_completion_date',
            'ActualCompletionDate': 'actual_completion_date',
            'ProjectStatus': 'project_status',
            'ProjectPriority': 'project_priority',
            'TotalContractAmount': 'total_contract_amount',
            'CreatedDate': 'created_date'
        }
    },
    'Estimates': {
        pgTable: 'estimates',
        columnMap: {
            'EstimateID': 'estimate_id',
            'ProjectID': 'project_id',
            'EstimateNumber': 'estimate_number',
            'EstimateDate': 'estimate_date',
            'TotalAmount': 'total_amount',
            'Status': 'status',
            'CreatedDate': 'created_date'
        }
    },
    'LineItems': {
        pgTable: 'line_items',
        columnMap: {
            'LineItemID': 'line_item_id',
            'EstimateID': 'estimate_id',
            'ItemDescription': 'item_description',
            'Quantity': 'quantity',
            'UnitPrice': 'unit_price',
            'TotalPrice': 'total_price',
            'CreatedDate': 'created_date'
        }
    },
    'Contracts': {
        pgTable: 'contracts',
        columnMap: {
            'ContractID': 'contract_id',
            'ProjectID': 'project_id',
            'ContractNumber': 'contract_number',
            'ContractType': 'contract_type',
            'ContractAmount': 'contract_amount',
            'ContractStatus': 'contract_status',
            'SignedDate': 'signed_date',
            'CreatedDate': 'created_date'
        }
    },
    'Invoices': {
        pgTable: 'invoices',
        columnMap: {
            'InvoiceID': 'invoice_id',
            'ProjectID': 'project_id',
            'InvoiceNumber': 'invoice_number',
            'InvoiceDate': 'invoice_date',
            'DueDate': 'due_date',
            'TotalAmount': 'total_amount',
            'Status': 'status',
            'CreatedDate': 'created_date'
        }
    },
    'Payments': {
        pgTable: 'payments',
        columnMap: {
            'PaymentID': 'payment_id',
            'InvoiceID': 'invoice_id',
            'PaymentAmount': 'payment_amount',
            'PaymentDate': 'payment_date',
            'PaymentMethod': 'payment_method',
            'PaymentStatus': 'payment_status',
            'CreatedDate': 'created_date'
        }
    },
    'PaymentTerms': {
        pgTable: 'payment_terms',
        columnMap: {
            'TermID': 'term_id',
            'TermName': 'term_name',
            'NetDays': 'net_days',
            'DiscountPercent': 'discount_percent',
            'DiscountDays': 'discount_days',
            'CreatedDate': 'created_date'
        }
    },
    'Settings': {
        pgTable: 'settings',
        columnMap: {
            'SettingID': 'setting_id',
            'SettingKey': 'setting_key',
            'SettingValue': 'setting_value',
            'CreatedDate': 'created_date'
        }
    }
};

async function exportFromAzure() {
    console.log('🔄 Step 1: Exporting data from Azure SQL...');
    
    try {
        const sql = require('mssql');
        
        // Connect to Azure SQL
        await sql.connect(azureConfig);
        console.log('✅ Connected to Azure SQL Database');
        
        const exportData = {};
        const exportDir = path.join(__dirname, 'azure-export');
        
        // Create export directory
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir);
        }
        
        // Export each table
        for (const [tableName, config] of Object.entries(tableMapping)) {
            try {
                console.log(`📋 Exporting ${tableName}...`);
                const request = new sql.Request();
                const result = await request.query(`SELECT * FROM ${tableName}`);
                
                exportData[tableName] = result.recordset || [];
                
                // Save individual table files
                fs.writeFileSync(
                    path.join(exportDir, `${tableName}.json`),
                    JSON.stringify(result.recordset, null, 2)
                );
                
                console.log(`✅ ${tableName}: ${result.recordset.length} records exported`);
            } catch (error) {
                console.log(`⚠️  ${tableName}: ${error.message} (table may not exist)`);
                exportData[tableName] = [];
            }
        }
        
        // Save complete export
        fs.writeFileSync(
            path.join(exportDir, 'complete-export.json'),
            JSON.stringify(exportData, null, 2)
        );
        
        // Save export metadata
        const exportInfo = {
            timestamp: new Date().toISOString(),
            source: 'Azure SQL',
            totalTables: Object.keys(tableMapping).length,
            totalRecords: Object.values(exportData).reduce((sum, data) => sum + data.length, 0),
            tables: Object.keys(exportData).map(table => ({
                name: table,
                records: exportData[table].length
            }))
        };
        
        fs.writeFileSync(
            path.join(exportDir, 'export-info.json'),
            JSON.stringify(exportInfo, null, 2)
        );
        
        await sql.close();
        
        console.log('\n🎉 Azure export completed!');
        console.log(`📁 Export saved to: ${exportDir}`);
        console.log(`📊 Total records: ${exportInfo.totalRecords}`);
        
        return exportDir;
        
    } catch (error) {
        console.error('❌ Azure export failed:', error.message);
        console.log('\n💡 Make sure you have:');
        console.log('   - Azure SQL credentials in environment variables');
        console.log('   - Network access to Azure SQL server');
        console.log('   - Valid database and table names');
        throw error;
    }
}

async function importToPostgreSQL(exportDir) {
    console.log('\n🔄 Step 2: Importing data to PostgreSQL...');
    
    try {
        const { Pool } = require('pg');
        
        // Connect to PostgreSQL
        const pool = new Pool(postgresConfig);
        console.log('✅ Connected to PostgreSQL Database');
        
        // Read the complete export
        const exportPath = path.join(exportDir, 'complete-export.json');
        if (!fs.existsSync(exportPath)) {
            throw new Error('Export data not found. Run Azure export first.');
        }
        
        const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
        let totalImported = 0;
        
        // Import tables in dependency order
        const importOrder = ['Users', 'Customers', 'Projects', 'Estimates', 'LineItems', 'Contracts', 'Invoices', 'Payments', 'PaymentTerms', 'Settings'];
        
        for (const tableName of importOrder) {
            const records = exportData[tableName] || [];
            if (records.length === 0) {
                console.log(`⚠️  ${tableName}: No data to import`);
                continue;
            }
            
            const config = tableMapping[tableName];
            if (!config) {
                console.log(`⚠️  ${tableName}: No mapping configuration`);
                continue;
            }
            
            console.log(`📥 Importing ${tableName} (${records.length} records)...`);
            
            try {
                // Clear existing data
                await pool.query(`TRUNCATE TABLE ${config.pgTable} RESTART IDENTITY CASCADE`);
                
                // Build insert query
                const pgColumns = Object.values(config.columnMap);
                const columnList = pgColumns.join(', ');
                const valuePlaceholders = pgColumns.map((_, i) => `$${i + 1}`).join(', ');
                
                const insertQuery = `INSERT INTO ${config.pgTable} (${columnList}) VALUES (${valuePlaceholders})`;
                
                // Insert records
                for (const record of records) {
                    const values = Object.keys(config.columnMap).map(azureCol => {
                        let value = record[azureCol];
                        
                        // Handle date formatting
                        if (value && typeof value === 'string' && value.includes('T')) {
                            value = new Date(value).toISOString();
                        }
                        
                        return value;
                    });
                    
                    await pool.query(insertQuery, values);
                }
                
                console.log(`✅ ${tableName}: ${records.length} records imported`);
                totalImported += records.length;
                
            } catch (error) {
                console.error(`❌ ${tableName} import failed:`, error.message);
            }
        }
        
        await pool.end();
        
        console.log('\n🎉 PostgreSQL import completed!');
        console.log(`📊 Total records imported: ${totalImported}`);
        
        // Save import summary
        const importInfo = {
            timestamp: new Date().toISOString(),
            target: 'PostgreSQL',
            totalImported: totalImported,
            status: 'completed'
        };
        
        fs.writeFileSync(
            path.join(exportDir, 'import-info.json'),
            JSON.stringify(importInfo, null, 2)
        );
        
    } catch (error) {
        console.error('❌ PostgreSQL import failed:', error.message);
        console.log('\n💡 Make sure you have:');
        console.log('   - DATABASE_URL environment variable set');
        console.log('   - PostgreSQL database created on Railway');
        console.log('   - Network access to Railway database');
        throw error;
    }
}

async function migrateAzureToPostgreSQL() {
    console.log('🚀 Starting Azure SQL to PostgreSQL migration...\n');
    
    try {
        // Step 1: Export from Azure
        const exportDir = await exportFromAzure();
        
        // Step 2: Import to PostgreSQL
        await importToPostgreSQL(exportDir);
        
        console.log('\n✅ Migration completed successfully!');
        console.log('🎉 Your Azure data is now in PostgreSQL on Railway');
        console.log('\n📝 Next steps:');
        console.log('   1. Update your Railway environment variables');
        console.log('   2. Deploy the updated database config');
        console.log('   3. Test your application');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Check your environment variables');
        console.log('   2. Verify database connectivity');
        console.log('   3. Check the error logs above');
        process.exit(1);
    }
}

// Check if running directly
if (require.main === module) {
    // Check for required environment variables
    const requiredVars = {
        azure: ['AZURE_DB_SERVER', 'AZURE_DB_DATABASE', 'AZURE_DB_USERNAME', 'AZURE_DB_PASSWORD'],
        postgres: ['DATABASE_URL']
    };
    
    const missingVars = [];
    
    console.log('🔍 Checking environment variables...\n');
    
    // Check Azure vars
    console.log('Azure SQL variables:');
    requiredVars.azure.forEach(varName => {
        if (process.env[varName]) {
            console.log(`✅ ${varName}: Set`);
        } else {
            console.log(`❌ ${varName}: Missing`);
            missingVars.push(varName);
        }
    });
    
    console.log('\nPostgreSQL variables:');
    requiredVars.postgres.forEach(varName => {
        if (process.env[varName]) {
            console.log(`✅ ${varName}: Set`);
        } else {
            console.log(`❌ ${varName}: Missing`);
            missingVars.push(varName);
        }
    });
    
    if (missingVars.length > 0) {
        console.log('\n❌ Missing required environment variables:');
        missingVars.forEach(varName => console.log(`   - ${varName}`));
        console.log('\n💡 Set these variables and try again.');
        process.exit(1);
    }
    
    console.log('\n✅ All environment variables set. Starting migration...\n');
    migrateAzureToPostgreSQL();
}

module.exports = {
    exportFromAzure,
    importToPostgreSQL,
    migrateAzureToPostgreSQL,
    tableMapping
};
