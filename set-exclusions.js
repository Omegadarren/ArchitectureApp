const database = require('./config/database');

async function setDefaultExclusions() {
    try {
        console.log('Setting default exclusions...');
        
        await database.connect();
        console.log('Connected to database');
        
        const exclusionsText = "Permit fees, printing, third party stamped engineering, if required, anything not specifically included in this estimate, unforeseen circumstances. Omega builders is not responsible for unpermittable projects, no refunds will be given once the work is complete. Coordinating with structural engineer and/or civil engineer is included, customer pays any necessary third party vendors directly.";
        
        // First ensure the settings table exists (call the settings API)
        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='settings' AND xtype='U')
            BEGIN
                CREATE TABLE settings (
                    id int IDENTITY(1,1) PRIMARY KEY,
                    setting_key varchar(255) NOT NULL UNIQUE,
                    setting_value text,
                    setting_type varchar(50) DEFAULT 'string',
                    created_at datetime DEFAULT GETDATE(),
                    updated_at datetime DEFAULT GETDATE()
                );
            END
        `;
        
        await database.query(createTableQuery);
        console.log('Settings table ready');
        
        // Insert or update the default exclusions
        const result = await database.query(`
            IF EXISTS (SELECT 1 FROM settings WHERE setting_key = 'default_exclusions')
                UPDATE settings 
                SET setting_value = '${exclusionsText.replace(/'/g, "''")}', 
                    setting_type = 'string', 
                    updated_at = GETDATE()
                WHERE setting_key = 'default_exclusions'
            ELSE
                INSERT INTO settings (setting_key, setting_value, setting_type) 
                VALUES ('default_exclusions', '${exclusionsText.replace(/'/g, "''")}', 'string')
        `);
        
        console.log('✅ Default exclusions set successfully!');
        
        // Verify it was set
        const verify = await database.query("SELECT setting_key, setting_value FROM settings WHERE setting_key = 'default_exclusions'");
        if (verify.recordset.length > 0) {
            console.log('📋 Exclusions text:', verify.recordset[0].setting_value);
        }
        
        await database.close();
        console.log('Database connection closed');
        
    } catch (error) {
        console.error('❌ Error setting exclusions:', error);
        process.exit(1);
    }
}

// Run the function
setDefaultExclusions()
    .then(() => {
        console.log('✨ Exclusions setup completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    });
