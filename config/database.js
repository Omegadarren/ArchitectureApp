const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class Database {
    constructor() {
        this.sqliteDb = null;
    }

    async connect() {
        try {
            // Use SQLite only
            if (this.sqliteDb) {
                console.log('SQLite database already connected');
                return this.sqliteDb;
            }
            
            const dbPath = process.env.NODE_ENV === 'production' 
                ? '/tmp/architecture.db' 
                : path.join(__dirname, '..', 'architecture.db');
            
            return new Promise((resolve, reject) => {
                this.sqliteDb = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        console.error('SQLite connection failed:', err);
                        reject(err);
                    } else {
                        console.log('Connected to SQLite database');
                        this.initializeTables();
                        resolve(this.sqliteDb);
                    }
                });
            });
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    initializeTables() {
        if (this.sqliteDb) {
            // Create basic tables for SQLite
            const tables = [
                `CREATE TABLE IF NOT EXISTS Users (
                    UserID INTEGER PRIMARY KEY AUTOINCREMENT,
                    Username TEXT UNIQUE,
                    Password TEXT,
                    FirstName TEXT,
                    LastName TEXT,
                    Email TEXT,
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS Customers (
                    CustomerID INTEGER PRIMARY KEY AUTOINCREMENT,
                    FirstName TEXT,
                    LastName TEXT,
                    CompanyName TEXT,
                    ContactName TEXT,
                    Email TEXT,
                    Phone TEXT,
                    ContactName2 TEXT,
                    Email2 TEXT,
                    Phone2 TEXT,
                    Address TEXT,
                    City TEXT,
                    State TEXT,
                    ZipCode TEXT,
                    Status TEXT DEFAULT 'active',
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS Projects (
                    ProjectID INTEGER PRIMARY KEY AUTOINCREMENT,
                    CustomerID INTEGER,
                    ProjectName TEXT,
                    ProjectDescription TEXT,
                    ProjectContactName TEXT,
                    ProjectContactPhone TEXT,
                    ProjectContactEmail TEXT,
                    ProjectAddress TEXT,
                    ProjectCity TEXT,
                    ProjectState TEXT,
                    ProjectZip TEXT,
                    StartDate DATE,
                    EstimatedCompletionDate DATE,
                    ActualCompletionDate DATE,
                    ProjectStatus TEXT DEFAULT 'Active',
                    ProjectPriority INTEGER DEFAULT 0,
                    TotalContractAmount DECIMAL(10,2) DEFAULT 0,
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS Estimates (
                    EstimateID INTEGER PRIMARY KEY AUTOINCREMENT,
                    ProjectID INTEGER,
                    EstimateNumber TEXT UNIQUE,
                    EstimateDate DATE,
                    TotalAmount DECIMAL(10,2),
                    Status TEXT DEFAULT 'Draft',
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS Contracts (
                    ContractID INTEGER PRIMARY KEY AUTOINCREMENT,
                    ProjectID INTEGER,
                    ContractNumber TEXT UNIQUE,
                    ContractType TEXT,
                    ContractAmount DECIMAL(10,2),
                    ContractStatus TEXT DEFAULT 'Draft',
                    SignedDate DATE,
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS Invoices (
                    InvoiceID INTEGER PRIMARY KEY AUTOINCREMENT,
                    ProjectID INTEGER,
                    InvoiceNumber TEXT UNIQUE,
                    InvoiceDate DATE,
                    DueDate DATE,
                    TotalAmount DECIMAL(10,2),
                    Status TEXT DEFAULT 'Draft',
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS Settings (
                    SettingID INTEGER PRIMARY KEY AUTOINCREMENT,
                    SettingKey TEXT UNIQUE,
                    SettingValue TEXT,
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            ];

            tables.forEach(sql => {
                this.sqliteDb.run(sql, (err) => {
                    if (err) console.error('Table creation error:', err);
                });
            });

            // Create default admin user after tables are created
            this.createDefaultAdminUser();
        }
    }

    async createDefaultAdminUser() {
        try {
            const bcrypt = require('bcryptjs');
            
            // Check if admin user already exists
            this.sqliteDb.get('SELECT Username FROM Users WHERE Username = ?', ['admin'], async (err, row) => {
                if (err) {
                    console.error('Error checking for admin user:', err);
                    return;
                }
                
                if (!row) {
                    // Admin user doesn't exist, create it
                    const hashedPassword = await bcrypt.hash('admin', 10);
                    this.sqliteDb.run(
                        'INSERT INTO Users (Username, Password, FirstName, LastName, Email) VALUES (?, ?, ?, ?, ?)',
                        ['admin', hashedPassword, 'Admin', 'User', 'admin@company.com'],
                        (err) => {
                            if (err) {
                                console.error('Error creating admin user:', err);
                            } else {
                                console.log('✅ Default admin user created (admin/admin)');
                            }
                        }
                    );
                } else {
                    console.log('✅ Admin user already exists');
                }
            });
        } catch (error) {
            console.error('Error in createDefaultAdminUser:', error);
        }
    }

    async query(queryString, params = []) {
        try {
            await this.connect();

            if (this.sqliteDb) {
                // SQLite query - convert Azure SQL syntax to SQLite
                let sqliteQuery = queryString
                    .replace(/TOP\s+(\d+)/gi, 'LIMIT $1')
                    .replace(/\[(\w+)\]/g, '$1')
                    .replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP')
                    .replace(/NEWID\(\)/gi, 'hex(randomblob(16))');

                return new Promise((resolve, reject) => {
                    if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
                        this.sqliteDb.all(sqliteQuery, params, (err, rows) => {
                            if (err) reject(err);
                            else resolve({ recordset: rows });
                        });
                    } else {
                        this.sqliteDb.run(sqliteQuery, params, function(err) {
                            if (err) reject(err);
                            else resolve({ rowsAffected: [this.changes] });
                        });
                    }
                });
            }
        } catch (error) {
            console.log('Query execution failed:', error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.sqliteDb) {
                this.sqliteDb.close((err) => {
                    if (err) console.error('SQLite close error:', err);
                    else console.log('SQLite database connection closed');
                });
            }
        } catch (error) {
            console.error('Error closing database connection:', error);
        }
    }

    async disconnect() {
        return this.close();
    }
}

module.exports = new Database();