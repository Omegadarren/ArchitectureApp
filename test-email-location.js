const database = require('./config/database');

async function testEmailLocation() {
    try {
        // Get a contract with project details
        const result = await database.query(`
            SELECT c.ContractID, c.ContractNumber, c.ContractType, c.ContractAmount,
                   c.ContractStatus, c.SignedDate, c.CreatedDate, c.ModifiedDate,
                   p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip, p.StartDate, p.EstimatedCompletionDate, p.ProjectDescription,
                   cust.CustomerID, cust.CompanyName, cust.ContactName, cust.Email, cust.Address, cust.City, cust.State, cust.ZipCode
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            WHERE c.ContractID = 4
        `);
        
        if (result.recordset.length === 0) {
            console.log('❌ Contract not found');
            return;
        }
        
        const contract = result.recordset[0];
        console.log('📋 Contract Data:');
        console.log('- Project Name:', contract.ProjectName);
        console.log('- Project Address:', contract.ProjectAddress);
        console.log('- Project City:', contract.ProjectCity);
        console.log('- Project State:', contract.ProjectState);
        
        // Test the location display logic
        const locationDisplay = `${contract.ProjectAddress || 'Project Address'}${contract.ProjectCity || contract.ProjectState ? ', ' + [contract.ProjectCity, contract.ProjectState].filter(Boolean).join(' ') : ''}`;
        
        console.log('\n📍 Email Location Display:');
        console.log(locationDisplay);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

testEmailLocation();
