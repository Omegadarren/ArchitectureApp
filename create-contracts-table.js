const database = require('./config/database');

async function createContractsTable() {
    try {
        console.log('Checking if Contracts table exists...');
        
        // Check if table exists
        const tableExists = await database.query(`
            SELECT COUNT(*) as tableCount 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'Contracts'
        `);
        
        if (tableExists.recordset[0].tableCount === 0) {
            console.log('Creating Contracts table...');
            
            await database.query(`
                CREATE TABLE Contracts (
                    ContractID INT IDENTITY(1,1) PRIMARY KEY,
                    ProjectID INT NOT NULL,
                    ContractNumber NVARCHAR(50) UNIQUE NOT NULL,
                    ContractType NVARCHAR(100),
                    ContractAmount DECIMAL(10,2) DEFAULT 0,
                    ContractStatus NVARCHAR(50) DEFAULT 'Draft',
                    SignedDate DATE NULL,
                    CreatedDate DATETIME DEFAULT GETDATE(),
                    ModifiedDate DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (ProjectID) REFERENCES Projects(ProjectID)
                )
            `);
            
            console.log('✅ Contracts table created successfully');
        } else {
            console.log('✅ Contracts table already exists');
        }
        
    } catch (error) {
        console.error('❌ Error creating Contracts table:', error);
    }
}

createContractsTable();
