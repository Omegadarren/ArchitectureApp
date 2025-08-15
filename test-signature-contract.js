const database = require('./config/database');
const { generateContractHtml } = require('./utils/contractTemplate');
const fs = require('fs').promises;

async function testSignatureInContract() {
    try {
        console.log('🧪 Testing signature in contract with new sizing...\n');
        
        // Get contract data
        const result = await database.query(`
            SELECT c.ContractID, c.ContractNumber, c.ContractStatus, c.ContractType, c.ContractAmount,
                   p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip,
                   p.ProjectDescription, p.StartDate, p.EstimatedCompletionDate,
                   cust.CompanyName, cust.ContactName, cust.Address, cust.City, cust.State, cust.ZipCode,
                   e.EstimateNumber
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            LEFT JOIN Estimates e ON p.ProjectID = e.ProjectID
            WHERE c.ContractID = 4
        `);
        
        if (result.recordset.length === 0) {
            console.log('❌ Contract not found');
            return;
        }
        
        const contract = result.recordset[0];
        
        // Generate contract HTML with current settings
        const contractHtml = await generateContractHtml(contract);
        
        // Save to file for testing
        await fs.writeFile('./test-signature-contract.html', contractHtml);
        
        console.log('✅ Test contract generated: test-signature-contract.html');
        console.log('📋 Contract includes:');
        console.log('- Project Address:', contract.ProjectAddress);
        console.log('- Estimate Number:', contract.EstimateNumber);
        
        // Check if signature styling is in the HTML
        const hasSignature = contractHtml.includes('max-height: 80px');
        console.log('- Signature Size Updated:', hasSignature ? '✅ Yes (80px height)' : '❌ No');
        
        const hasTransparentBg = contractHtml.includes('background-color: transparent');
        console.log('- Transparent Background:', hasTransparentBg ? '✅ Yes' : '❌ No');
        
        const hasImageEnhancement = contractHtml.includes('filter: brightness');
        console.log('- Image Enhancement:', hasImageEnhancement ? '✅ Yes' : '❌ No');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

testSignatureInContract();
