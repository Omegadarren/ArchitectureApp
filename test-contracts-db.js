// Test contracts database directly
const database = require('./config/database');
require('dotenv').config();

async function testContractsData() {
    try {
        console.log('🔍 Testing contracts database...');
        await database.connect();
        
        // Check if there are any contracts
        const contractCount = await database.query(`
            SELECT COUNT(*) as contractCount FROM Contracts
        `);
        
        console.log(`📊 Found ${contractCount.recordset[0].contractCount} contracts in database`);
        
        if (contractCount.recordset[0].contractCount > 0) {
            // Get a sample of contracts to verify the query structure
            const sampleContracts = await database.query(`
                SELECT TOP 3 c.ContractID, c.ContractNumber, c.ContractType, 
                       c.ContractAmount, c.ContractStatus,
                       p.ProjectName, cust.CompanyName
                FROM Contracts c
                INNER JOIN Projects p ON c.ProjectID = p.ProjectID
                INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            `);
            
            console.log('✅ Sample contracts:', sampleContracts.recordset);
        } else {
            console.log('ℹ️ No contracts found - creating a test contract...');
            
            // Get a project to create a test contract
            const projects = await database.query(`
                SELECT TOP 1 ProjectID FROM Projects
            `);
            
            if (projects.recordset.length > 0) {
                const projectId = projects.recordset[0].ProjectID;
                const contractNumber = `CONT-${Date.now()}`;
                
                await database.query(`
                    INSERT INTO Contracts (ProjectID, ContractNumber, ContractType, ContractStatus, ContractAmount)
                    VALUES (@projectId, @contractNumber, 'Design Contract', 'Draft', 5000)
                `, { 
                    projectId: projectId, 
                    contractNumber: contractNumber 
                });
                
                console.log('✅ Created test contract:', contractNumber);
            }
        }
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
    } finally {
        await database.close();
        process.exit(0);
    }
}

testContractsData();
