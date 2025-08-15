const express = require('express');
const router = express.Router();
const database = require('../config/database.local');
const settingsHelper = require('../utils/settingsHelper');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Get all settings
router.get('/', async (req, res) => {
    try {
        await database.connect();
        
        // First, ensure the settings table exists and has default data
        const checkTableQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name='Settings'`;
        const tableExists = await database.query(checkTableQuery);
        
        if (tableExists.recordset.length === 0) {
            // Create table and insert default settings
            const createTableQuery = `
                CREATE TABLE Settings (
                    SettingID INTEGER PRIMARY KEY AUTOINCREMENT,
                    SettingKey TEXT UNIQUE NOT NULL,
                    SettingValue TEXT,
                    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            await database.query(createTableQuery);
            
            // Insert default settings
            const defaultSettings = [
                ['company_name', 'Omega Builders LLC'],
                ['company_address', '123 Construction Ave, Builder City, BC 12345'],
                ['company_phone', '(555) 123-4567'],
                ['company_email', 'contact@omegabuilders.com'],
                ['company_website', 'www.omegabuilders.com'],
                ['tax_rate', '0.0875'],
                ['payment_terms', '30'],
                ['hourly_rate', '75.00'],
                ['invoice_footer', 'Thank you for your business!'],
                ['contract_footer', 'This contract is legally binding.'],
                ['default_exclusions', 'Permit fees, printing, third party stamped engineering, if required, anything not specifically included in this estimate, unforeseen circumstances. Omega builders is not responsible for unpermittable projects, no refunds will be given once the work is complete. Coordinating with structural engineer and/or civil engineer is included, customer pays any necessary third party vendors directly.'],
                ['currency_symbol', '$'],
                ['date_format', 'MM/dd/yyyy'],
                ['email_notifications', 'true'],
                ['auto_backup', 'true'],
                ['show_logo', 'true'],
                ['require_project_approval', 'false']
            ];
            
            for (const [key, value] of defaultSettings) {
                await database.query(`INSERT INTO Settings (SettingKey, SettingValue) VALUES (?, ?)`, [key, value]);
            }
        }
        
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
        
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
router.put('/', async (req, res) => {
    try {
        await database.connect();
        const settings = req.body;
        
        // Update each setting
        for (const [key, value] of Object.entries(settings)) {
            let settingValue = value;
            
            if (typeof value === 'number') {
                settingValue = value.toString();
            } else if (typeof value === 'boolean') {
                settingValue = value.toString();
            }
            
            // Update or insert the setting using SQLite syntax
            await database.query(`
                INSERT INTO Settings (SettingKey, SettingValue, UpdatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(SettingKey) DO UPDATE SET 
                    SettingValue = ?, 
                    UpdatedAt = CURRENT_TIMESTAMP
            `, [key, settingValue, settingValue]);
        }
        
        // Clear the settings cache
        settingsHelper.clearCache();
        
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Reset settings to defaults
router.post('/reset', async (req, res) => {
    try {
        await database.connect();
        
        // Delete all existing settings
        await database.query('DELETE FROM settings');
        
        // Insert default settings
        const defaultSettings = [
            ['company_name', 'Your Company Name', 'string'],
            ['company_address', 'Your Company Address', 'string'],
            ['company_phone', '(555) 123-4567', 'string'],
            ['company_email', 'contact@yourcompany.com', 'string'],
            ['company_website', 'www.yourcompany.com', 'string'],
            ['tax_rate', '0.0875', 'number'],
            ['payment_terms', '30', 'number'],
            ['hourly_rate', '75.00', 'number'],
            ['invoice_footer', 'Thank you for your business!', 'string'],
            ['contract_footer', 'This contract is legally binding.', 'string'],
            ['default_exclusions', 'Permit fees, printing, third party stamped engineering, if required, anything not specifically included in this estimate, unforeseen circumstances. Omega builders is not responsible for unpermittable projects, no refunds will be given once the work is complete. Coordinating with structural engineer and/or civil engineer is included, customer pays any necessary third party vendors directly.', 'string'],
            ['currency_symbol', '$', 'string'],
            ['date_format', 'MM/dd/yyyy', 'string'],
            ['email_notifications', 'true', 'boolean'],
            ['auto_backup', 'true', 'boolean'],
            ['show_logo', 'true', 'boolean'],
            ['require_project_approval', 'false', 'boolean']
        ];
        
        for (const [key, value, type] of defaultSettings) {
            await database.query(`
                INSERT INTO settings (setting_key, setting_value, setting_type) 
                VALUES (@key, @value, @type)
            `, {
                key: key,
                value: value,
                type: type
            });
        }
        
        // Clear the settings cache
        settingsHelper.clearCache();
        
        res.json({ message: 'Settings reset to defaults successfully' });
    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({ error: 'Failed to reset settings' });
    }
});

// Export/backup settings
router.get('/export', async (req, res) => {
    try {
        await database.connect();
        
        const result = await database.query(`
            SELECT setting_key, setting_value, setting_type
            FROM settings
            ORDER BY setting_key
        `);
        
        const exportData = {
            exported_at: new Date().toISOString(),
            version: '1.0',
            settings: result.recordset
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=settings-backup.json');
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting settings:', error);
        res.status(500).json({ error: 'Failed to export settings' });
    }
});

// Configure multer for signature upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'signatures');
        // Ensure directory exists
        fs.mkdir(uploadDir, { recursive: true }).then(() => {
            cb(null, uploadDir);
        }).catch(err => cb(err));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, 'signature-' + uniqueSuffix + extension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check if the file is an image
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Upload signature image
router.post('/signature-upload', upload.single('signature'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        await database.connect();

        // Generate the URL for the uploaded image
        const imageUrl = `/uploads/signatures/${req.file.filename}`;

        // Save the signature image URL to settings
        const updateQuery = `
            INSERT INTO Settings (SettingKey, SettingValue) 
            VALUES ('signature_image_url', ?) 
            ON CONFLICT(SettingKey) 
            DO UPDATE SET SettingValue = ?, UpdatedAt = CURRENT_TIMESTAMP
        `;
        
        await database.query(updateQuery, [imageUrl, imageUrl]);

        // Clear the settings cache
        settingsHelper.clearCache();

        res.json({
            success: true,
            message: 'Signature uploaded successfully',
            imageUrl: imageUrl,
            filename: req.file.filename
        });

    } catch (error) {
        console.error('Error uploading signature:', error);
        
        // Clean up uploaded file if there was an error
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error cleaning up uploaded file:', unlinkError);
            }
        }
        
        res.status(500).json({ error: 'Failed to upload signature' });
    }
});

// Remove signature image
router.delete('/signature-remove', async (req, res) => {
    try {
        await database.connect();

        // Get the current signature URL
        const getQuery = `SELECT SettingValue FROM Settings WHERE SettingKey = 'signature_image_url'`;
        const result = await database.query(getQuery);

        if (result.recordset.length > 0 && result.recordset[0].SettingValue) {
            const imageUrl = result.recordset[0].SettingValue;
            const filename = path.basename(imageUrl);
            const filePath = path.join(__dirname, '..', 'uploads', 'signatures', filename);

            // Remove the file
            try {
                await fs.unlink(filePath);
                console.log('Signature file deleted:', filePath);
            } catch (fileError) {
                console.error('Error deleting signature file:', fileError);
                // Continue even if file deletion fails
            }
        }

        // Remove the setting from database
        const deleteQuery = `DELETE FROM Settings WHERE SettingKey = 'signature_image_url'`;
        await database.query(deleteQuery);

        // Clear the settings cache
        settingsHelper.clearCache();

        res.json({
            success: true,
            message: 'Signature removed successfully'
        });

    } catch (error) {
        console.error('Error removing signature:', error);
        res.status(500).json({ error: 'Failed to remove signature' });
    }
});

module.exports = router;
