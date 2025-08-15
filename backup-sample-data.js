const database = require('./config/database');
const fs = require('fs');
const path = require('path');

async function backupSampleData() {
    try {
        console.log('💾 Creating backup of current sample data...');
        
        await database.connect();
        const backupData = {
            timestamp: new Date().toISOString(),
            tables: {}
        };
        
        // Tables to backup (in order)
        const tables = [
            'Customers',
            'Projects',
            'Estimates', 
            'EstimateLineItems',
            'Invoices',
            'Payments',
            'Contracts',
            'LineItems'
        ];
        
        for (const table of tables) {
            console.log(`📋 Backing up ${table}...`);
            try {
                const result = await database.query(`SELECT * FROM ${table}`);
                backupData.tables[table] = result.recordset;
                console.log(`✅ Backed up ${result.recordset.length} records from ${table}`);
            } catch (error) {
                console.log(`⚠️  Could not backup ${table}: ${error.message}`);
                backupData.tables[table] = [];
            }
        }
        
        // Save backup to file
        const backupFilename = `sample-data-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const backupPath = path.join(__dirname, backupFilename);
        
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        console.log(`💾 Backup saved to: ${backupFilename}`);
        console.log('🎉 Backup completed successfully!');
        
        await database.close();
        return backupFilename;
        
    } catch (error) {
        console.error('❌ Error during backup:', error);
        throw error;
    }
}

// Run the backup
if (require.main === module) {
    backupSampleData()
        .then((filename) => {
            console.log(`✨ Backup completed: ${filename}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Backup failed:', error);
            process.exit(1);
        });
}

module.exports = { backupSampleData };
