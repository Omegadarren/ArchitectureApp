const database = require('./config/database');

async function checkExclusions() {
    try {
        await database.connect();
        const result = await database.query("SELECT setting_key, setting_value FROM settings WHERE setting_key = 'default_exclusions'");
        console.log('Exclusions setting:', result.recordset);
        
        // Also check all settings to see what's there
        const all = await database.query("SELECT setting_key, LEFT(setting_value, 50) + '...' as preview FROM settings ORDER BY setting_key");
        console.log('\nAll settings:');
        all.recordset.forEach(row => {
            console.log(`${row.setting_key}: ${row.preview}`);
        });
        
        await database.close();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkExclusions();
