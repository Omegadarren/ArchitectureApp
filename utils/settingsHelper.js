const database = require('../config/database.local');

class SettingsHelper {
    constructor() {
        this.cachedSettings = null;
        this.lastCacheTime = null;
        this.cacheExpiration = 5 * 60 * 1000; // 5 minutes
    }

    async getSettings() {
        const now = Date.now();
        
        // Return cached settings if they're still fresh
        if (this.cachedSettings && this.lastCacheTime && (now - this.lastCacheTime < this.cacheExpiration)) {
            return this.cachedSettings;
        }

        try {
            await database.connect();
            
            // Get all settings
            const result = await database.query(`
                SELECT SettingKey as setting_key, SettingValue as setting_value
                FROM Settings
                ORDER BY SettingKey
            `);
            
            // Convert to key-value object
            const settings = {};
            result.recordset.forEach(row => {
                let value = row.setting_value;
                
                // Convert based on key patterns
                if (['tax_rate', 'payment_terms', 'hourly_rate'].includes(row.setting_key)) {
                    value = parseFloat(value);
                } else if (['email_notifications', 'auto_backup', 'show_logo', 'require_project_approval'].includes(row.setting_key)) {
                    value = value.toLowerCase() === 'true';
                }
                
                settings[row.setting_key] = value;
            });
            
            // Cache the settings
            this.cachedSettings = settings;
            this.lastCacheTime = now;
            
            return settings;
        } catch (error) {
            console.error('Error loading settings:', error);
            // Return default values if database fails
            return {
                company_name: 'Omega Builders LLC',
                company_address: '123 Construction Ave, Builder City, BC 12345',
                company_phone: '(555) 123-4567',
                company_email: 'contact@omegabuilders.com',
                company_website: 'www.omegabuilders.com',
                tax_rate: 0.0875,
                payment_terms: 30,
                hourly_rate: 75.00,
                invoice_footer: 'Thank you for your business!',
                contract_footer: 'This contract is legally binding.',
                currency_symbol: '$',
                date_format: 'MM/dd/yyyy',
                email_notifications: true,
                auto_backup: true,
                show_logo: true,
                require_project_approval: false
            };
        }
    }

    async getSetting(key, defaultValue = null) {
        const settings = await this.getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    // Clear cache when settings are updated
    clearCache() {
        this.cachedSettings = null;
        this.lastCacheTime = null;
    }
}

// Create singleton instance
const settingsHelper = new SettingsHelper();

module.exports = settingsHelper;
