const database = require('./config/database');

async function testUpdatedQuery() {
    try {
        console.log('🔍 Testing Updated Contract Email Query...\n');
        
        // Test the same query that the email function now uses
        const result = await database.query(`
            SELECT c.ContractID, c.ContractNumber, c.ContractStatus, c.ContractType, c.ContractAmount,
                   p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip,
                   cust.CompanyName, cust.ContactName, cust.Email,
                   e.EstimateNumber
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            LEFT JOIN Estimates e ON p.ProjectID = e.ProjectID
            WHERE c.ContractID = 4
        `);
        
        if (result.recordset.length === 0) {
            console.log('❌ Contract 4 not found!');
            return;
        }
        
        const contract = result.recordset[0];
        console.log('📋 Updated Contract Data for Email:');
        console.log('- ContractNumber:', contract.ContractNumber);
        console.log('- ProjectName:', contract.ProjectName);
        console.log('- ProjectAddress:', contract.ProjectAddress);
        console.log('- ProjectCity:', contract.ProjectCity);
        console.log('- ProjectState:', contract.ProjectState);
        console.log('- CompanyName:', contract.CompanyName);
        console.log('- ContactName:', contract.ContactName);
        console.log('- Email:', contract.Email);
        console.log('- ContractAmount:', contract.ContractAmount);
        console.log('- EstimateNumber:', contract.EstimateNumber);
        
        // Test the location display
        const locationDisplay = `${contract.ProjectAddress || 'Project Address'}${contract.ProjectCity || contract.ProjectState ? ', ' + [contract.ProjectCity, contract.ProjectState].filter(Boolean).join(' ') : ''}`;
        console.log('\n📍 Location Display Test:');
        console.log(locationDisplay);
        
        // Test contract template values
        console.log('\n📋 Contract Template Values:');
        console.log('- EstimateNumber for template:', contract.EstimateNumber || 'TBD');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

testUpdatedQuery();
