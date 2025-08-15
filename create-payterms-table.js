const sql = require('mssql');
const database = require('./config/database');

async function createPayTermsTable() {
    try {
        await database.connect();
        console.log('Connected to database');

        // Check if PayTerms table exists
        const tableExists = await database.query(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'PayTerms'
        `);

        if (tableExists.recordset[0].count === 0) {
            console.log('Creating PayTerms table...');
            
            await database.query(`
                CREATE TABLE PayTerms (
                    PayTermID int IDENTITY(1,1) PRIMARY KEY,
                    ProjectID int NOT NULL FOREIGN KEY REFERENCES Projects(ProjectID),
                    EstimateID int NULL FOREIGN KEY REFERENCES Estimates(EstimateID),
                    PayTermType nvarchar(50) NOT NULL, -- 'Contract Acceptance', 'Permit Submittal', 'Project Start', 'Project Completion', 'Custom'
                    PayTermName nvarchar(100) NOT NULL,
                    PercentageAmount decimal(5,2) NULL, -- Percentage of estimate total
                    FixedAmount money NULL, -- Fixed dollar amount
                    DueDate date NULL,
                    PayTermDescription nvarchar(500) NULL,
                    PayTermStatus nvarchar(20) DEFAULT 'Pending', -- 'Pending', 'Paid', 'Overdue'
                    CreatedDate datetime2 DEFAULT GETDATE(),
                    ModifiedDate datetime2 DEFAULT GETDATE()
                );
            `);
            
            console.log('PayTerms table created successfully!');
            
            // Create indexes
            await database.query(`
                CREATE INDEX IX_PayTerms_ProjectID ON PayTerms (ProjectID);
                CREATE INDEX IX_PayTerms_EstimateID ON PayTerms (EstimateID);
                CREATE INDEX IX_PayTerms_Status ON PayTerms (PayTermStatus);
            `);
            
            console.log('PayTerms table indexes created successfully!');
        } else {
            console.log('PayTerms table already exists');
        }

    } catch (error) {
        console.error('Error creating PayTerms table:', error);
    } finally {
        await database.close();
        console.log('Database connection closed');
    }
}

// Run the function
createPayTermsTable();
