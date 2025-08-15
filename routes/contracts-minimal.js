// Minimal contracts.js with working email 
const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { sendEmail } = require('../config/email');

// Simple email function for customer contract signing
async function sendCustomerContractEmail(contract, signingUrl) {
    try {
        console.log('📧 Attempting to send contract email to:', contract.Email);
        
        const subject = `Contract Ready for Your Signature - ${contract.ContractNumber}`;
        const htmlContent = `
            <h1>OMEGA BUILDERS, LLC</h1>
            <h2>Contract Ready for Your Digital Signature</h2>
            <p>Dear ${contract.ContactName},</p>
            <p>Your design contract for <strong>${contract.ProjectName}</strong> is ready for your digital signature.</p>
            <p><strong>Contract Number:</strong> ${contract.ContractNumber}</p>
            <p><strong>Project:</strong> ${contract.ProjectName}</p>
            <p><a href="${signingUrl}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none;">SIGN CONTRACT NOW</a></p>
            <p>Best regards,<br>Omega Builders, LLC</p>
        `;

        const result = await sendEmail(contract.Email, subject, htmlContent);
        console.log('📧 Email send result:', result);
        return result.success;
    } catch (error) {
        console.error('❌ Error sending customer contract email:', error);
        return false;
    }
}

// Send contract to customer for signature
router.post('/:id/send-to-customer', async (req, res) => {
    try {
        const contractId = req.params.id;
        console.log(`📧 Sending contract ${contractId} to customer for signature...`);

        // Get contract and customer details
        const result = await database.query(`
            SELECT c.ContractID, c.ContractNumber, c.ContractStatus,
                   p.ProjectName,
                   cust.CompanyName, cust.ContactName, cust.Email
            FROM Contracts c
            INNER JOIN Projects p ON c.ProjectID = p.ProjectID
            INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
            WHERE c.ContractID = @contractId
        `, { contractId });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        const contract = result.recordset[0];

        if (!contract.Email) {
            return res.status(400).json({ error: 'Customer email not found' });
        }

        if (contract.ContractStatus === 'Signed') {
            return res.status(400).json({ error: 'Contract is already signed' });
        }

        // Create signing URL
        const signingUrl = `${req.protocol}://${req.get('host')}/contract-signing/${contractId}`;
        
        // Send email to customer
        const emailSent = await sendCustomerContractEmail(contract, signingUrl);
        
        if (emailSent) {
            console.log(`✅ Contract signing email sent to ${contract.Email}`);
            res.json({ 
                message: 'Contract sent to customer successfully',
                customerEmail: contract.Email,
                signingUrl: signingUrl
            });
        } else {
            throw new Error('Failed to send email');
        }

    } catch (error) {
        console.error('❌ Error sending contract to customer:', error);
        res.status(500).json({ error: 'Failed to send contract to customer', details: error.message });
    }
});

// Temporary - other routes will be added back later
router.get('/', async (req, res) => {
    res.json({ message: 'Contracts API - temporarily simplified for testing' });
});

module.exports = router;
