const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'architecture.db');

class Database {
    constructor() {
        this.db = null;
    }

    async connect() {
        try {
            if (this.db) {
                console.log('Database already connected, reusing existing connection');
                return this.db;
            }
            
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Database connection failed:', err);
                    throw err;
                } else {
                    console.log('Connected to SQLite database');
                }
            });

            // Enable foreign keys
            this.db.run('PRAGMA foreign_keys = ON');
            
            // Create tables if they don't exist
            await this.createTables();
            
            return this.db;
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createSettingsTable = `
                CREATE TABLE IF NOT EXISTS Settings (
                    SettingID INTEGER PRIMARY KEY AUTOINCREMENT,
                    SettingKey TEXT UNIQUE NOT NULL,
                    SettingValue TEXT,
                    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            this.db.run(createSettingsTable, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async query(queryString, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                this.connect().then(() => {
                    this.executeQuery(queryString, params, resolve, reject);
                }).catch(reject);
            } else {
                this.executeQuery(queryString, params, resolve, reject);
            }
        });
    }

    executeQuery(queryString, params, resolve, reject) {
        try {
            // Handle different query types
            if (queryString.trim().toUpperCase().startsWith('SELECT')) {
                if (Array.isArray(params)) {
                    this.db.all(queryString, params, (err, rows) => {
                        if (err) {
                            console.error('Query execution failed:', err);
                            reject(err);
                        } else {
                            resolve({ recordset: rows });
                        }
                    });
                } else {
                    // Convert MSSQL-style parameters (@param) to SQLite-style (?param)
                    let sqliteQuery = queryString;
                    const paramKeys = Object.keys(params);
                    const paramValues = [];

                    paramKeys.forEach(key => {
                        sqliteQuery = sqliteQuery.replace(new RegExp(`@${key}`, 'g'), '?');
                        paramValues.push(params[key]);
                    });

                    this.db.all(sqliteQuery, paramValues, (err, rows) => {
                        if (err) {
                            console.error('Query execution failed:', err);
                            reject(err);
                        } else {
                            resolve({ recordset: rows });
                        }
                    });
                }
            } else {
                if (Array.isArray(params)) {
                    this.db.run(queryString, params, function(err) {
                        if (err) {
                            console.error('Query execution failed:', err);
                            reject(err);
                        } else {
                            resolve({ 
                                recordset: [], 
                                rowsAffected: [this.changes],
                                lastInsertId: this.lastID 
                            });
                        }
                    });
                } else {
                    // Convert MSSQL-style parameters (@param) to SQLite-style (?param)
                    let sqliteQuery = queryString;
                    const paramKeys = Object.keys(params);
                    const paramValues = [];

                    paramKeys.forEach(key => {
                        sqliteQuery = sqliteQuery.replace(new RegExp(`@${key}`, 'g'), '?');
                        paramValues.push(params[key]);
                    });

                    this.db.run(sqliteQuery, paramValues, function(err) {
                        if (err) {
                            console.error('Query execution failed:', err);
                            reject(err);
                        } else {
                            resolve({ 
                                recordset: [], 
                                rowsAffected: [this.changes],
                                lastInsertId: this.lastID 
                            });
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Query execution failed:', error);
            reject(error);
        }
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database connection:', err);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new Database();
