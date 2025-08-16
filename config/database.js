const sql = require('mssql');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Azure SQL config
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true, // Use encryption for Azure
        trustServerCertificate: false // Don't trust self-signed certificates
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

class Database {
    constructor() {
        this.pool = null;
        this.sqliteDb = null;
        this.useAzure = process.env.DB_SERVER && process.env.NODE_ENV !== 'development';
    }

    async connect() {
        try {
            if (this.useAzure) {
                // Try Azure SQL first
                if (this.pool && this.pool.connected) {
                    console.log('Database already connected, reusing existing connection');
                    return this.pool;
                }
                
                this.pool = await sql.connect(config);
                console.log('Connected to Azure SQL Database');
                return this.pool;
            } else {
                // Fallback to SQLite for development/deployment
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
            }
        } catch (error) {
            console.error('Database connection failed:', error);
            // Fallback to SQLite if Azure fails
            if (this.useAzure) {
                console.log('Falling back to SQLite...');
                this.useAzure = false;
                return this.connect();
            }
            throw error;
        }
    }

    initializeTables() {
        if (!this.useAzure && this.sqliteDb) {
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
                    Email TEXT,
                    Phone TEXT,
                    Address TEXT,
                    City TEXT,
                    State TEXT,
                    Zip TEXT,
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS Projects (
                    ProjectID INTEGER PRIMARY KEY AUTOINCREMENT,
                    CustomerID INTEGER,
                    ProjectName TEXT,
                    ProjectAddress TEXT,
                    ProjectCity TEXT,
                    ProjectState TEXT,
                    ProjectZip TEXT,
                    Status TEXT DEFAULT 'Active',
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

            // Insert default admin user if not exists
            this.sqliteDb.run(`INSERT OR IGNORE INTO Users (Username, Password, FirstName, LastName, Email) VALUES (?, ?, ?, ?, ?)`, 
                ['admin', '$2b$10$rQJ5D1mZqYQJ5D1mZqYQJ5D1mZqYQJ5D1mZqYQJ5D1mZqYQJ5D1mZq', 'Admin', 'User', 'admin@company.com']);
        }
    }

    async query(queryString, params = {}) {
        try {
            await this.connect();

            if (this.useAzure && this.pool) {
                // Azure SQL query
                const request = this.pool.request();
                
                Object.keys(params).forEach(key => {
                    request.input(key, params[key]);
                });
                
                const result = await request.query(queryString);
                return result;
            } else if (this.sqliteDb) {
                // SQLite query - convert Azure SQL syntax to SQLite
                let sqliteQuery = queryString
                    .replace(/TOP\s+(\d+)/gi, 'LIMIT $1')
                    .replace(/\[(\w+)\]/g, '$1')
                    .replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP')
                    .replace(/NEWID\(\)/gi, 'hex(randomblob(16))');

                return new Promise((resolve, reject) => {
                    if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
                        this.sqliteDb.all(sqliteQuery, Object.values(params), (err, rows) => {
                            if (err) reject(err);
                            else resolve({ recordset: rows });
                        });
                    } else {
                        this.sqliteDb.run(sqliteQuery, Object.values(params), function(err) {
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
            if (this.pool && this.useAzure) {
                await this.pool.close();
                console.log('Azure SQL Database connection closed');
            }
            if (this.sqliteDb && !this.useAzure) {
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