const database = require('./config/database');

async function checkEstimateStructure() {
    try {
        console.log('🔍 Checking Estimates Table Structure...\n');
        
        // Check the Estimates table schema
        const schemaResult = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Estimates'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('📝 Estimates Table Columns:');
        schemaResult.recordset.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
        });
        
        // Check if we have estimates data
        const dataResult = await database.query(`
            SELECT TOP 5 * FROM Estimates ORDER BY EstimateID DESC
        `);
        
        console.log('\n📊 Sample Estimates Data:');
        if (dataResult.recordset.length > 0) {
            dataResult.recordset.forEach(est => {
                console.log(`  EstimateID: ${est.EstimateID}, ProjectID: ${est.ProjectID || 'N/A'}, EstimateNumber: ${est.EstimateNumber || 'N/A'}`);
            });
        } else {
            console.log('  No estimates found');
        }
        
        // Check if there's a relationship between Contracts and Estimates
        console.log('\n🔍 Checking Contract-Estimate Relationship...');
        const contractSchemaResult = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts'
            AND (COLUMN_NAME LIKE '%Estimate%' OR COLUMN_NAME LIKE '%estimate%')
            ORDER BY COLUMN_NAME
        `);
        
        if (contractSchemaResult.recordset.length > 0) {
            console.log('📝 Contract Estimate-related columns:');
            contractSchemaResult.recordset.forEach(col => {
                console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
            });
        } else {
            console.log('❌ No direct estimate reference in Contracts table');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkEstimateStructure();
