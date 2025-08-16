const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = null;
        this.sqliteDb = null;
        this.dbType = process.env.DB_TYPE || 'sqlite';
    }

    async connect() {
        try {
            if (this.dbType === 'postgresql' && process.env.DATABASE_URL) {
                // PostgreSQL for Railway production
                if (this.pool) {
                    console.log('PostgreSQL database already connected');
                    return this.pool;
                }

                this.pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
                });

                // Test connection
                const client = await this.pool.connect();
                await client.query('SELECT NOW()');
                client.release();
                
                console.log('✅ Connected to PostgreSQL database');
                await this.initializePostgresTables();
                await this.createDefaultAdminUser();
                return this.pool;
                
            } else {
                // SQLite for local development
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
                            console.log('✅ Connected to SQLite database');
                            this.initializeSQLiteTables();
                            resolve(this.sqliteDb);
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    async initializePostgresTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                email VARCHAR(255),
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS customers (
                customer_id SERIAL PRIMARY KEY,
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                company_name VARCHAR(255),
                contact_name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                contact_name2 VARCHAR(255),
                email2 VARCHAR(255),
                phone2 VARCHAR(50),
                address TEXT,
                city VARCHAR(255),
                state VARCHAR(100),
                zip_code VARCHAR(20),
                status VARCHAR(50) DEFAULT 'active',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS projects (
                project_id SERIAL PRIMARY KEY,
                customer_id INTEGER REFERENCES customers(customer_id),
                project_name VARCHAR(500),
                project_description TEXT,
                project_contact_name VARCHAR(255),
                project_contact_phone VARCHAR(50),
                project_contact_email VARCHAR(255),
                project_address TEXT,
                project_city VARCHAR(255),
                project_state VARCHAR(100),
                project_zip VARCHAR(20),
                start_date DATE,
                estimated_completion_date DATE,
                actual_completion_date DATE,
                project_status VARCHAR(50) DEFAULT 'Active',
                project_priority INTEGER DEFAULT 0,
                total_contract_amount DECIMAL(10,2) DEFAULT 0,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS estimates (
                estimate_id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(project_id),
                estimate_number VARCHAR(50) UNIQUE,
                estimate_date DATE,
                total_amount DECIMAL(10,2),
                status VARCHAR(50) DEFAULT 'Draft',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS line_items (
                line_item_id SERIAL PRIMARY KEY,
                estimate_id INTEGER REFERENCES estimates(estimate_id),
                item_description TEXT,
                quantity DECIMAL(10,2),
                unit_price DECIMAL(10,2),
                total_price DECIMAL(10,2),
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS contracts (
                contract_id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(project_id),
                contract_number VARCHAR(50) UNIQUE,
                contract_type VARCHAR(100),
                contract_amount DECIMAL(10,2),
                contract_status VARCHAR(50) DEFAULT 'Draft',
                signed_date DATE,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS invoices (
                invoice_id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(project_id),
                invoice_number VARCHAR(50) UNIQUE,
                invoice_date DATE,
                due_date DATE,
                total_amount DECIMAL(10,2),
                status VARCHAR(50) DEFAULT 'Draft',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS payments (
                payment_id SERIAL PRIMARY KEY,
                invoice_id INTEGER REFERENCES invoices(invoice_id),
                payment_amount DECIMAL(10,2),
                payment_date DATE,
                payment_method VARCHAR(100),
                payment_status VARCHAR(50) DEFAULT 'Pending',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS payment_terms (
                term_id SERIAL PRIMARY KEY,
                term_name VARCHAR(255),
                net_days INTEGER,
                discount_percent DECIMAL(5,2),
                discount_days INTEGER,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS settings (
                setting_id SERIAL PRIMARY KEY,
                setting_key VARCHAR(255) UNIQUE,
                setting_value TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            try {
                await this.pool.query(sql);
            } catch (err) {
                console.error('PostgreSQL table creation error:', err);
            }
        }
        console.log('✅ PostgreSQL tables initialized');
    }

    initializeSQLiteTables() {
        if (this.sqliteDb) {
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
                `CREATE TABLE IF NOT EXISTS LineItems (
                    LineItemID INTEGER PRIMARY KEY AUTOINCREMENT,
                    EstimateID INTEGER,
                    ItemDescription TEXT,
                    Quantity DECIMAL(10,2),
                    UnitPrice DECIMAL(10,2),
                    TotalPrice DECIMAL(10,2),
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
                `CREATE TABLE IF NOT EXISTS Payments (
                    PaymentID INTEGER PRIMARY KEY AUTOINCREMENT,
                    InvoiceID INTEGER,
                    PaymentAmount DECIMAL(10,2),
                    PaymentDate DATE,
                    PaymentMethod TEXT,
                    PaymentStatus TEXT DEFAULT 'Pending',
                    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS PaymentTerms (
                    TermID INTEGER PRIMARY KEY AUTOINCREMENT,
                    TermName TEXT,
                    NetDays INTEGER,
                    DiscountPercent DECIMAL(5,2),
                    DiscountDays INTEGER,
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

            console.log('✅ SQLite tables initialized');
            this.createDefaultAdminUser();
        }
    }

    async createDefaultAdminUser() {
        try {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('admin', 10);
            
            if (this.dbType === 'postgresql' && this.pool) {
                // Check if admin user exists
                const result = await this.pool.query('SELECT username FROM users WHERE username = $1', ['admin']);
                
                if (result.rows.length === 0) {
                    await this.pool.query(
                        'INSERT INTO users (username, password, first_name, last_name, email) VALUES ($1, $2, $3, $4, $5)',
                        ['admin', hashedPassword, 'Admin', 'User', 'admin@company.com']
                    );
                    console.log('✅ Default admin user created (admin/admin)');
                } else {
                    console.log('✅ Admin user already exists');
                }
            } else if (this.sqliteDb) {
                // SQLite version
                this.sqliteDb.get('SELECT Username FROM Users WHERE Username = ?', ['admin'], async (err, row) => {
                    if (err) {
                        console.error('Error checking for admin user:', err);
                        return;
                    }
                    
                    if (!row) {
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
            }
        } catch (error) {
            console.error('Error in createDefaultAdminUser:', error);
        }
    }

    async query(queryString, params = []) {
        try {
            await this.connect();

            if (this.dbType === 'postgresql' && this.pool) {
                // PostgreSQL query
                let pgQuery = queryString
                    .replace(/TOP\s+(\d+)/gi, 'LIMIT $1')
                    .replace(/\[(\w+)\]/g, '$1')
                    .replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP')
                    .replace(/NEWID\(\)/gi, 'gen_random_uuid()');

                // Convert ? parameters to $1, $2, etc.
                let paramIndex = 1;
                pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

                const result = await this.pool.query(pgQuery, params);
                return { recordset: result.rows, rowsAffected: [result.rowCount] };
                
            } else if (this.sqliteDb) {
                // SQLite query
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
            if (this.pool) {
                await this.pool.end();
                console.log('PostgreSQL database connection closed');
            }
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
