const database = require('./config/database');

async function clearSampleData() {
    try {
        console.log('🧹 Starting database cleanup - removing all sample data...');
        
        await database.connect();
        console.log('Connected to Azure SQL Database');
        
        // Clear data in the correct order due to foreign key constraints
        // Start with dependent tables first, then parent tables
        
        console.log('🗑️  Clearing estimate line items...');
        await database.query('DELETE FROM EstimateLineItems');
        console.log('✅ Estimate line items cleared');
        
        console.log('🗑️  Clearing invoice line items...');
        await database.query('DELETE FROM InvoiceLineItems');
        console.log('✅ Invoice line items cleared');
        
        console.log('🗑️  Clearing contracts...');
        await database.query('DELETE FROM Contracts');
        console.log('✅ Contracts cleared');
        
        console.log('🗑️  Clearing payments...');
        await database.query('DELETE FROM Payments');
        console.log('✅ Payments cleared');
        
        console.log('🗑️  Clearing pay terms...');
        await database.query('DELETE FROM PayTerms');
        console.log('✅ Pay terms cleared');
        
        console.log('🗑️  Clearing invoices...');
        await database.query('DELETE FROM Invoices');
        console.log('✅ Invoices cleared');
        
        console.log('️  Clearing estimates...');
        await database.query('DELETE FROM Estimates');
        console.log('✅ Estimates cleared');
        
        console.log('️  Clearing projects...');
        await database.query('DELETE FROM Projects');
        console.log('✅ Projects cleared');
        
        console.log('🗑️  Clearing customers...');
        await database.query('DELETE FROM Customers');
        console.log('✅ Customers cleared');
        
        // Keep settings as they are system configuration
        console.log('⚠️  Preserving settings (system configuration)');
        
        // Reset identity columns to start from 1 again
        console.log('🔄 Resetting identity counters...');
        
        const tables = [
            'Customers',
            'Projects', 
            'Estimates',
            'Invoices',
            'Payments',
            'Contracts',
            'EstimateLineItems',
            'InvoiceLineItems',
            'PayTerms'
        ];
        
        for (const table of tables) {
            try {
                await database.query(`DBCC CHECKIDENT('${table}', RESEED, 0)`);
                console.log(`✅ Reset identity for ${table}`);
            } catch (error) {
                console.log(`⚠️  Could not reset identity for ${table}: ${error.message}`);
            }
        }
        
        console.log('🎉 Database cleanup completed successfully!');
        console.log('📊 Summary:');
        console.log('   - All customer data removed');
        console.log('   - All project data removed');  
        console.log('   - All estimates removed');
        console.log('   - All invoices removed');
        console.log('   - All payments removed');
        console.log('   - All contracts removed');
        console.log('   - All line items removed (estimate line items and invoice line items)');
        console.log('   - All pay terms removed');
        console.log('   - Settings preserved');
        console.log('   - Identity counters reset to start from 1');
        
        await database.close();
        
    } catch (error) {
        console.error('❌ Error during database cleanup:', error);
        throw error;
    }
}

// Run the cleanup
clearSampleData()
    .then(() => {
        console.log('✨ Cleanup completed. Your database is ready for fresh data!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Cleanup failed:', error);
        process.exit(1);
    });
