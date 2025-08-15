const database = require('./config/database');

async function checkAndCreatePaymentsTable() {
    try {
        await database.connect();
        console.log('Connected to database');
        
        // Try to select from Payments table
        try {
            const result = await database.query('SELECT TOP 1 * FROM Payments');
            console.log('Payments table already exists with', result.recordset.length, 'records');
        } catch (error) {
            if (error.message.includes('Invalid object name')) {
                console.log('Payments table does not exist - creating it...');
                
                await database.query(`
                    CREATE TABLE Payments (
                        PaymentID int IDENTITY(1,1) PRIMARY KEY,
                        InvoiceID int NOT NULL,
                        PaymentAmount decimal(10,2) NOT NULL,
                        PaymentDate date NOT NULL,
                        PaymentMethod nvarchar(50),
                        PaymentReference nvarchar(255),
                        CreatedDate datetime2 DEFAULT GETDATE(),
                        FOREIGN KEY (InvoiceID) REFERENCES Invoices(InvoiceID) ON DELETE CASCADE
                    )
                `);
                
                console.log('Payments table created successfully');
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
    
    process.exit(0);
}

checkAndCreatePaymentsTable();
