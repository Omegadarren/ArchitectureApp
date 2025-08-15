const database = require('./config/database');

async function createTestSigningLink() {
    try {
        await database.connect();
        
        // Get a draft contract
        const result = await database.query(`
            SELECT TOP 1 c.ContractID, c.ContractNumber, c.ContractStatus,
                   p.ProjectName, cust.CompanyName, cust.Email
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            WHERE c.ContractStatus = 'Draft'
            ORDER BY c.ContractID DESC
        `);
        
        if (result.recordset.length === 0) {
            console.log('❌ No draft contracts available for testing');
            return;
        }
        
        const contract = result.recordset[0];
        const signingUrl = `http://localhost:3000/contract-signing/${contract.ContractID}`;
        
        console.log('🔍 Test Contract Details:');
        console.log(`   Contract: ${contract.ContractNumber}`);
        console.log(`   Project: ${contract.ProjectName}`);
        console.log(`   Customer: ${contract.CompanyName}`);
        console.log(`   Email: ${contract.Email}`);
        console.log(`   Status: ${contract.ContractStatus}`);
        console.log('');
        console.log('🌐 Contract Signing URL:');
        console.log(`   ${signingUrl}`);
        console.log('');
        console.log('📱 Test Instructions:');
        console.log('1. Open the URL above in your browser (or on your phone)');
        console.log('2. Fill in the signature fields');
        console.log('3. Click "Sign Contract"');
        console.log('4. Check for any errors in browser console (F12)');
        console.log('');
        console.log('💡 Common Issues to Check:');
        console.log('- Browser console errors (F12 → Console)');
        console.log('- Network tab for failed API calls (F12 → Network)');
        console.log('- Check if running on http vs https');
        console.log('- Try both desktop and mobile browsers');
        
        await database.close();
        
    } catch (error) {
        console.error('❌ Error creating test signing link:', error);
    }
}

createTestSigningLink().then(() => {
    console.log('\n🎉 Test signing link generated!');
}).catch(error => {
    console.error('💥 Failed to generate link:', error);
});
