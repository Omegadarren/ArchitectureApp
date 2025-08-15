const database = require('./config/database');

async function testContractData() {
    try {
        await database.connect();
        console.log('Testing contract data with project location...');
        
        const result = await database.query(`
            SELECT c.ContractID, c.ContractNumber, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
        `);
        
        console.log('Contract data:', JSON.stringify(result.recordset, null, 2));
        
        await database.close();
    } catch (error) {
        console.error('Error:', error);
    }
}

testContractData();
