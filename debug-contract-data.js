const database = require('./config/database');

async function debugContractData() {
    try {
        console.log('🔍 Debugging Contract 4 Data...\n');
        
        // Check the contract data that the email function receives
        const result = await database.query(`
            SELECT c.ContractID, c.ContractNumber, c.ContractType, c.ContractAmount,
                   c.ContractStatus, c.SignedDate, c.CreatedDate, c.ModifiedDate,
                   p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip, 
                   p.StartDate, p.EstimatedCompletionDate, p.ProjectDescription,
                   cust.CustomerID, cust.CompanyName, cust.ContactName, cust.Email, 
                   cust.Address, cust.City, cust.State, cust.ZipCode
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            WHERE c.ContractID = 4
        `);
        
        if (result.recordset.length === 0) {
            console.log('❌ Contract 4 not found!');
            return;
        }
        
        const contract = result.recordset[0];
        console.log('📋 Contract Data for Email:');
        console.log('- ContractID:', contract.ContractID);
        console.log('- ContractNumber:', contract.ContractNumber);
        console.log('- ProjectName:', contract.ProjectName);
        console.log('- ProjectAddress:', contract.ProjectAddress);
        console.log('- ProjectCity:', contract.ProjectCity);
        console.log('- ProjectState:', contract.ProjectState);
        console.log('- CompanyName:', contract.CompanyName);
        console.log('- ContactName:', contract.ContactName);
        console.log('- Email:', contract.Email);
        console.log('- ContractAmount:', contract.ContractAmount);
        
        // Check if there are estimates for this project
        console.log('\n🔍 Looking for Estimates for this Project...');
        const estimateResult = await database.query(`
            SELECT EstimateID, EstimateNumber, ProjectID, EstimateAmount, EstimateDate
            FROM Estimates 
            WHERE ProjectID = @projectId
            ORDER BY EstimateDate DESC
        `, { projectId: contract.ProjectID });
        
        if (estimateResult.recordset.length > 0) {
            console.log('📊 Found Estimates:');
            estimateResult.recordset.forEach((est, index) => {
                console.log(`  ${index + 1}. EstimateID: ${est.EstimateID}, Number: ${est.EstimateNumber}, Amount: ${est.EstimateAmount}`);
            });
        } else {
            console.log('❌ No estimates found for this project!');
        }
        
        // Check if the contract has an EstimateNumber field
        console.log('\n🔍 Checking Contract Schema...');
        const schemaResult = await database.query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Contracts'
            AND COLUMN_NAME LIKE '%Estimate%'
            ORDER BY COLUMN_NAME
        `);
        
        if (schemaResult.recordset.length > 0) {
            console.log('📝 Contract Estimate-related columns:');
            schemaResult.recordset.forEach(col => {
                console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
            });
        } else {
            console.log('❌ No estimate-related columns found in Contracts table!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

debugContractData();
