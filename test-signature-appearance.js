const { generateContractHtml } = require('./utils/contractTemplate');

// Test contract data with signature
const testContract = {
    ContractID: 4,
    CustomerID: 1,
    ProjectID: 1,
    ContractNumber: 'CON-004',
    ContractAmount: 15000.00,
    StartDate: new Date('2024-02-01'),
    EstimatedCompletionDate: new Date('2024-06-01'),
    EstimateNumber: 'EST-004',
    PayTerms: 'Net 30 days\n50% down payment\n25% at halfway point\n25% upon completion',
    CompanyName: 'Test Client LLC',
    CustomerName: 'John Doe',
    CustomerAddress: '123 Main St',
    CustomerCity: 'Anytown',
    CustomerState: 'CA',
    CustomerZip: '12345',
    ProjectName: 'Kitchen Renovation',
    ProjectAddress: '456 Oak Ave',
    ProjectCity: 'Somewhere',
    ProjectState: 'CA',
    ProjectZip: '67890'
};

// Generate and save contract HTML to see signature styling
(async () => {
    try {
        const contractHtml = await generateContractHtml(testContract);
        
        // Extract just the signature line to see the styling
        const signatureMatch = contractHtml.match(/By:.*?<\/p>/);
        if (signatureMatch) {
            console.log('🖋️  Signature line styling:');
            console.log(signatureMatch[0]);
            console.log('\n📝 Key styling changes:');
            console.log('- background-color: white (matches document background)');
            console.log('- mix-blend-mode: multiply (makes signature ink blend naturally)');
            console.log('- Removed brightness/contrast filters that were darkening the background');
        }
        
        // Save full contract for testing
        require('fs').writeFileSync('test-signature-contract.html', contractHtml);
        console.log('\n✅ Full contract saved as test-signature-contract.html');
        console.log('📖 Open in browser to see signature appearance');
        
    } catch (error) {
        console.error('❌ Error generating contract:', error.message);
    }
    
    process.exit(0);
})();
