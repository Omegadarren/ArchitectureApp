// Script to check and create missing database tables
const database = require('./config/database');
require('dotenv').config();

async function checkAndCreateTables() {
    try {
        console.log('Connecting to database...');
        await database.connect();
        console.log('Connected successfully!');

        // Check if ChangeOrders table exists (referenced in projects.js)
        const changeOrdersCheck = await database.query(`
            SELECT COUNT(*) as tableCount 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'ChangeOrders'
        `);
        
        if (changeOrdersCheck.recordset[0].tableCount === 0) {
            console.log('Creating ChangeOrders table...');
            await database.query(`
                CREATE TABLE ChangeOrders (
                    ChangeOrderID INT IDENTITY(1,1) PRIMARY KEY,
                    ProjectID INT NOT NULL,
                    ChangeOrderNumber NVARCHAR(50) NOT NULL,
                    ChangeOrderDate DATE DEFAULT GETDATE(),
                    Description NVARCHAR(MAX),
                    Reason NVARCHAR(500),
                    SubTotal DECIMAL(10,2) DEFAULT 0,
                    TaxRate DECIMAL(5,4) DEFAULT 0,
                    TaxAmount DECIMAL(10,2) DEFAULT 0,
                    TotalAmount DECIMAL(10,2) DEFAULT 0,
                    ChangeOrderStatus NVARCHAR(50) DEFAULT 'Pending',
                    ApprovedDate DATE NULL,
                    Notes NVARCHAR(MAX),
                    CreatedDate DATETIME DEFAULT GETDATE(),
                    ModifiedDate DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (ProjectID) REFERENCES Projects(ProjectID)
                )
            `);
            console.log('✅ ChangeOrders table created successfully');
        } else {
            console.log('✅ ChangeOrders table already exists');
        }

        // Check all existing tables
        const allTables = await database.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);
        
        console.log('\n📊 Current database tables:');
        allTables.recordset.forEach(table => {
            console.log(`  - ${table.TABLE_NAME}`);
        });

        // Check for any missing columns in existing tables
        console.log('\n🔍 Checking for missing columns...');
        
        // Check if Projects table has ProjectPriority column
        const projectColumns = await database.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Projects'
        `);
        
        const hasProjectPriority = projectColumns.recordset.some(col => col.COLUMN_NAME === 'ProjectPriority');
        
        if (!hasProjectPriority) {
            console.log('Adding ProjectPriority column to Projects table...');
            await database.query(`
                ALTER TABLE Projects 
                ADD ProjectPriority INT DEFAULT 0
            `);
            console.log('✅ ProjectPriority column added successfully');
        } else {
            console.log('✅ ProjectPriority column already exists');
        }

        console.log('\n✅ All table checks completed!');
        
    } catch (error) {
        console.error('❌ Error checking/creating tables:', error);
    } finally {
        await database.close();
        process.exit(0);
    }
}

checkAndCreateTables();
