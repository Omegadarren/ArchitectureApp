const database = require('./config/database');

async function checkColumns() {
    try {
        const result = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Customers' 
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('Customers table columns:');
        result.recordset.forEach(row => {
            console.log(`- ${row.COLUMN_NAME} (${row.DATA_TYPE}, ${row.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'})`);
        });
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

checkColumns();
