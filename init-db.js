// Database initialization script for Railway deployment
const bcrypt = require('bcryptjs');

// Simple SQLite setup for Railway
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function initializeRailwayDatabase() {
    console.log('🚀 Initializing Railway database...');
    
    // Use the same database path as the main app
    const dbPath = process.env.NODE_ENV === 'production' 
        ? '/tmp/architecture.db' 
        : path.join(__dirname, 'architecture.db');
    
    console.log('Database path:', dbPath);
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, async (err) => {
            if (err) {
                console.error('❌ Database connection failed:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to SQLite database');
            
            try {
                // Create Users table if it doesn't exist
                await new Promise((res, rej) => {
                    db.run(`CREATE TABLE IF NOT EXISTS Users (
                        UserID INTEGER PRIMARY KEY AUTOINCREMENT,
                        Username TEXT UNIQUE,
                        Password TEXT,
                        FirstName TEXT,
                        LastName TEXT,
                        Email TEXT,
                        CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, (err) => {
                        if (err) rej(err);
                        else {
                            console.log('✅ Users table ready');
                            res();
                        }
                    });
                });
                
                // Check if admin user exists
                const existingUser = await new Promise((res, rej) => {
                    db.get('SELECT Username FROM Users WHERE Username = ?', ['admin'], (err, row) => {
                        if (err) rej(err);
                        else res(row);
                    });
                });
                
                if (existingUser) {
                    console.log('✅ Admin user already exists');
                } else {
                    // Create admin user
                    const hashedPassword = await bcrypt.hash('admin', 10);
                    
                    await new Promise((res, rej) => {
                        db.run(
                            'INSERT INTO Users (Username, Password, FirstName, LastName, Email) VALUES (?, ?, ?, ?, ?)',
                            ['admin', hashedPassword, 'Admin', 'User', 'admin@company.com'],
                            (err) => {
                                if (err) rej(err);
                                else {
                                    console.log('✅ Admin user created successfully!');
                                    console.log('📝 Login credentials: admin / admin');
                                    res();
                                }
                            }
                        );
                    });
                }
                
                // Close database
                db.close((err) => {
                    if (err) console.error('Error closing database:', err);
                    else console.log('✅ Database connection closed');
                    resolve();
                });
                
            } catch (error) {
                console.error('❌ Error during initialization:', error);
                db.close();
                reject(error);
            }
        });
    });
}

// Run the initialization
if (require.main === module) {
    initializeRailwayDatabase()
        .then(() => {
            console.log('🎉 Database initialization complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Database initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeRailwayDatabase };
