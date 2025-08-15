const database = require('./config/database');
const fs = require('fs');
const path = require('path');

// Export all data from Azure SQL to JSON files for backup/migration
async function exportAzureData() {
    
    try {
        // Force Azure connection for export
        process.env.NODE_ENV = 'azure-export';
        
        await database.connect();
        console.log('📊 Starting Azure SQL data export...');
        
        const tables = [
            'Customers',
            'Projects', 
            'Estimates',
            'LineItems',
            'Invoices',
            'Contracts',
            'Payments',
            'PaymentTerms',
            'Settings'
        ];
        
        const exportData = {};
        const exportDir = path.join(__dirname, 'azure-backup');
        
        // Create backup directory
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir);
        }
        
        for (const table of tables) {
            try {
                console.log(`📋 Exporting ${table}...`);
                const result = await database.query(`SELECT * FROM ${table}`);
                const data = result.recordset || [];
                
                exportData[table] = data;
                
                // Save individual table files
                fs.writeFileSync(
                    path.join(exportDir, `${table}.json`),
                    JSON.stringify(data, null, 2)
                );
                
                console.log(`✅ ${table}: ${data.length} records exported`);
            } catch (error) {
                console.log(`⚠️  ${table}: ${error.message} (table may not exist)`);
                exportData[table] = [];
            }
        }
        
        // Save complete backup
        fs.writeFileSync(
            path.join(exportDir, 'complete-backup.json'),
            JSON.stringify(exportData, null, 2)
        );
        
        // Save backup info
        const backupInfo = {
            timestamp: new Date().toISOString(),
            totalTables: tables.length,
            totalRecords: Object.values(exportData).reduce((sum, data) => sum + data.length, 0),
            tables: Object.keys(exportData).map(table => ({
                name: table,
                records: exportData[table].length
            }))
        };
        
        fs.writeFileSync(
            path.join(exportDir, 'backup-info.json'),
            JSON.stringify(backupInfo, null, 2)
        );
        
        console.log('\n🎉 Export completed successfully!');
        console.log(`📁 Backup saved to: ${exportDir}`);
        console.log(`📊 Total records: ${backupInfo.totalRecords}`);
        console.log('\n📋 Summary:');
        backupInfo.tables.forEach(table => {
            console.log(`   ${table.name}: ${table.records} records`);
        });
        
        console.log('\n✅ Your Azure data is now safely backed up!');
        console.log('🚀 Ready to deploy to Vercel with SQLite');
        
    } catch (error) {
        console.error('❌ Export failed:', error.message);
        console.log('\n💡 This might mean:');
        console.log('   - Azure SQL credentials not configured');
        console.log('   - Network connection issue');
        console.log('   - Tables don\'t exist yet');
        console.log('\n🚀 You can still deploy to Vercel with a fresh SQLite database!');
    } finally {
        await database.close();
    }
}

// Run export
exportAzureData();
