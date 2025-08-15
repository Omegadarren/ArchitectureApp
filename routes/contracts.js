// Minimal contracts.js with working email 
const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { sendEmail } = require('../config/email');
const settingsHelper = require('../utils/settingsHelper');

// Enhanced email function for customer contract signing with full contract details
const { generateContractHtml } = require('../utils/contractTemplate');

async function sendCustomerContractEmail(contract, signingUrl) {
 try {
 console.log(' Attempting to send contract email to:', contract.Email);
 
 // Get settings for company information
 const settings = await settingsHelper.getSettings();
 
 // Format currency helper
 const formatCurrency = (amount) => {
 if (!amount) return '$0.00';
 return new Intl.NumberFormat('en-US', {
 style: 'currency',
 currency: 'USD',
 minimumFractionDigits: 2
 }).format(amount);
 };
 
 const subject = `Contract Ready for Your Digital Signature - ${contract.ContractNumber}`;
 const htmlContent = `
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Contract for Digital Signature</title>
 <style>
 body { 
 font-family: Arial, sans-serif; 
 line-height: 1.6; 
 color: #333; 
 margin: 0; 
 padding: 0;
 background-color: #f5f5f5;
 }
 .email-container {
 max-width: 700px;
 margin: 0 auto;
 background-color: white;
 box-shadow: 0 0 10px rgba(0,0,0,0.1);
 }
 .header { 
 background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); 
 color: white; 
 padding: 30px 20px; 
 text-align: center; 
 }
 .header h1 {
 margin: 0 0 10px 0;
 font-size: 2rem;
 }
 .header h2 {
 margin: 0;
 font-size: 1.3rem;
 font-weight: normal;
 opacity: 0.9;
 }
 .content { 
 padding: 30px; 
 }
 .intro-message {
 background-color: #e7f3ff;
 border: 1px solid #b3d9ff;
 border-left: 4px solid #007bff;
 padding: 20px;
 margin: 0 0 30px 0;
 border-radius: 4px;
 }
 .intro-message p {
 margin: 0 0 10px 0;
 }
 .intro-message p:last-child {
 margin-bottom: 0;
 }
 .contract-summary {
 background-color: #f8f9fa;
 border: 1px solid #dee2e6;
 border-radius: 8px;
 padding: 25px;
 margin: 20px 0 30px 0;
 border-left: 4px solid #007bff;
 }
 .summary-row {
 display: flex;
 justify-content: space-between;
 align-items: center;
 padding: 8px 0;
 border-bottom: 1px solid #e9ecef;
 }
 .summary-row:last-child {
 border-bottom: none;
 font-size: 1.1rem;
 font-weight: bold;
 color: #28a745;
 padding-top: 15px;
 margin-top: 10px;
 border-top: 2px solid #28a745;
 }
 .summary-label {
 font-weight: 600;
 color: #495057;
 }
 .summary-value {
 color: #212529;
 }
 .sign-button-container {
 text-align: center;
 margin: 30px 0;
 padding: 25px;
 background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
 border-radius: 12px;
 border: 3px solid #28a745;
 }
 .sign-button-text {
 font-size: 1.1rem;
 font-weight: 600;
 color: #155724;
 margin-bottom: 15px;
 }
 .sign-button { 
 display: inline-block; 
 background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%); 
 color: white; 
 padding: 18px 40px; 
 text-decoration: none; 
 border-radius: 30px; 
 font-weight: bold; 
 font-size: 1.2rem;
 box-shadow: 0 6px 12px rgba(40, 167, 69, 0.4);
 transition: all 0.3s ease;
 text-transform: uppercase;
 letter-spacing: 1px;
 }
 .sign-button:hover {
 transform: translateY(-3px);
 box-shadow: 0 8px 16px rgba(40, 167, 69, 0.6);
 background: linear-gradient(135deg, #218838 0%, #1c7430 100%);
 color: white;
 text-decoration: none;
 }
 .important-notice {
 background-color: #fff3cd;
 border: 1px solid #ffeaa7;
 border-left: 4px solid #ffc107;
 padding: 20px;
 margin: 25px 0;
 border-radius: 4px;
 }
 .important-notice h4 {
 color: #856404;
 margin: 0 0 10px 0;
 font-size: 1.1rem;
 }
 .important-notice p {
 margin: 0;
 color: #856404;
 font-weight: 500;
 }
 .footer { 
 background-color: #f1f3f4; 
 padding: 20px; 
 text-align: center; 
 font-size: 14px; 
 color: #666; 
 border-top: 1px solid #dee2e6;
 }
 .important { 
 color: #dc3545; 
 font-weight: bold; 
 }
 .success { 
 color: #28a745; 
 font-weight: bold; 
 }
 
 /* Mobile responsive */
 @media (max-width: 768px) {
 .content {
 padding: 15px;
 }
 .header {
 padding: 20px 15px;
 }
 .header h1 {
 font-size: 1.5rem;
 }
 .header h2 {
 font-size: 1.1rem;
 }
 }
 </style>
 </head>
 <body>
 <div class="email-container">
 <div class="header">
 <h1>${settings.company_name || 'Omega Builders, LLC'}</h1>
 <h2>Contract Ready for Your Digital Signature</h2>
 </div>
 
 <div class="content">
 <div class="intro-message">
 <p><strong>Dear ${contract.ContactName || 'Valued Client'},</strong></p>
 <p>Your design contract is ready for your digital signature. Below is a summary of your contract details. When you click "Review & Sign Contract", you'll see the complete contract with all terms and conditions.</p>
 <p><strong>Once signed, the fully executed contract will be automatically emailed to both you and our office.</strong></p>
 </div>

 <!-- Contract Summary -->
 <div class="contract-summary">
 <h3 style="color: #007bff; margin-bottom: 20px; text-align: center; font-size: 1.4rem;">
 Contract Summary
 </h3>
 <div class="summary-row">
 <span class="summary-label">Contract Number:</span>
 <span class="summary-value">${contract.ContractNumber || contract.ContractID}</span>
 </div>
 <div class="summary-row">
 <span class="summary-label">Project:</span>
 <span class="summary-value">${contract.ProjectName || 'Design Project'}</span>
 </div>
 <div class="summary-row">
 <span class="summary-label">Location:</span>
 <span class="summary-value">${contract.ProjectAddress || 'Project Address'}${contract.ProjectCity || contract.ProjectState ? ', ' + [contract.ProjectCity, contract.ProjectState].filter(Boolean).join(' ') : ''}</span>
 </div>
 <div class="summary-row">
 <span class="summary-label">Client:</span>
 <span class="summary-value">${contract.CompanyName || 'Client Name'}</span>
 </div>
 <div class="summary-row">
 <span class="summary-label">Total Contract Amount:</span>
 <span class="summary-value">${contract.ContractAmount ? formatCurrency(contract.ContractAmount) : 'To Be Determined'}</span>
 </div>
 </div>

 <!-- Important Notice -->
 <div class="important-notice">
 <h4>What happens next?</h4>
 <p>• Click the button below to view the complete contract and sign electronically<br>
 • Review all terms and conditions carefully before signing<br>
 • The signed contract will be automatically emailed to you and our office<br>
 • You'll receive a copy for your records within minutes of signing</p>
 </div>

 <!-- Sign Button -->
 <div class="sign-button-container">
 <p style="text-align: center; font-size: 18px; font-weight: bold; color: #333; margin: 20px 0;">
 Ready to proceed? <a href="${signingUrl}" style="color: #28a745; font-weight: bold; text-decoration: underline;">Click here to review the full contract and sign</a>
 </p>
 </div>
 </div>
 
 <div class="footer">
 <p><strong>${settings.company_name || 'Omega Builders, LLC'}</strong></p>
 <p>${settings.company_address || '1934 Florence St, Enumclaw, WA 98022'}</p>
 <p> ${settings.company_email || 'info@omegabuilders.com'} | ${settings.company_phone || '(555) 123-4567'}</p>
 <hr style="border: none; border-top: 1px solid #ccc; margin: 15px 0;">
 <p style="font-size: 12px; color: #999;">
 This email contains confidential contract information. Please do not forward this email or signing link to others.
 </p>
 <p style="font-size: 12px; margin-top: 10px;">
 Contract Link: <a href="${signingUrl}" style="color: #0056b3; font-weight: bold; text-decoration: underline; background-color: #f8f9fa; padding: 2px 6px; border-radius: 4px;">${signingUrl}</a>
 </p>
 </div>
 </div>
 </body>
 </html>
 `;

 const result = await sendEmail(contract.Email, subject, htmlContent);
 console.log(' Email send result:', result);
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
 console.log(` Sending contract ${contractId} to customer for signature...`);

 // Get contract and customer details
 const result = await database.query(`
 SELECT c.ContractID, c.ContractNumber, c.ContractStatus, c.ContractType, c.ContractAmount,
 p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip,
 cust.CompanyName, cust.ContactName, cust.Email,
 e.EstimateNumber
 FROM Contracts c
 INNER JOIN Projects p ON c.ProjectID = p.ProjectID
 INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
 LEFT JOIN Estimates e ON p.ProjectID = e.ProjectID
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

 // Create signing URL using configurable base URL
 const settingsHelper = require('../utils/settingsHelper');
 const settings = await settingsHelper.getSettings();
 const baseUrl = settings.base_url || `${req.protocol}://${req.get('host')}`;
 const signingUrl = `${baseUrl}/contract-signing/${contractId}`;
 
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

// Get all contracts with project and customer info
router.get('/', async (req, res) => {
 try {
 const result = await database.query(`
 SELECT c.ContractID, c.ContractNumber, c.ContractType, c.ContractAmount,
 c.ContractStatus, c.SignedDate, c.CreatedDate, c.ModifiedDate,
 p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip, p.StartDate, p.EstimatedCompletionDate,
 cust.CustomerID, cust.CompanyName, cust.ContactName, cust.Address, cust.City, cust.State, cust.ZipCode
 FROM Contracts c
 INNER JOIN Projects p ON c.ProjectID = p.ProjectID
 INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
 ORDER BY c.CreatedDate DESC
 `);
 
 res.json(result.recordset);
 } catch (error) {
 console.error('Error fetching contracts:', error);
 res.status(500).json({ error: 'Failed to fetch contracts' });
 }
});

// Get full contract HTML for signing page
router.get('/:id/full-html', async (req, res) => {
 try {
 const contractId = req.params.id;
 
 // Get contract details with customer and project info
 const result = await database.query(`
 SELECT c.*, 
 p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip,
 p.ProjectDescription, p.StartDate, p.EstimatedCompletionDate,
 cust.CompanyName, cust.ContactName, cust.Address, cust.City, cust.State, cust.ZipCode,
 e.EstimateNumber
 FROM Contracts c
 INNER JOIN Projects p ON c.ProjectID = p.ProjectID 
 INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
 LEFT JOIN Estimates e ON p.ProjectID = e.ProjectID
 WHERE c.ContractID = @contractId
 `, { contractId });

 if (result.recordset.length === 0) {
 return res.status(404).json({ error: 'Contract not found' });
 }

 const contract = result.recordset[0];
 
 // Generate full contract HTML
 const contractHtml = await generateContractHtml(contract);
 
 res.setHeader('Content-Type', 'text/html');
 res.send(contractHtml);
 
 } catch (error) {
 console.error('❌ Error getting contract HTML:', error);
 res.status(500).json({ error: 'Server error generating contract HTML' });
 }
});

// Get single contract by ID
router.get('/:id', async (req, res) => {
 try {
 const result = await database.query(`
 SELECT c.ContractID, c.ContractNumber, c.ContractType, c.ContractAmount,
 c.ContractStatus, c.SignedDate, c.CreatedDate, c.ModifiedDate,
 p.ProjectID, p.ProjectName, p.ProjectAddress, p.ProjectCity, p.ProjectState, p.ProjectZip, p.StartDate, p.EstimatedCompletionDate, p.ProjectDescription,
 cust.CustomerID, cust.CompanyName, cust.ContactName, cust.Email, cust.Address, cust.City, cust.State, cust.ZipCode
 FROM Contracts c
 INNER JOIN Projects p ON c.ProjectID = p.ProjectID
 INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
 WHERE c.ContractID = @contractId
 `, { contractId: req.params.id });
 
 if (result.recordset.length === 0) {
 return res.status(404).json({ error: 'Contract not found' });
 }
 
 res.json(result.recordset[0]);
 } catch (error) {
 console.error('Error fetching contract:', error);
 res.status(500).json({ error: 'Failed to fetch contract' });
 }
});

// Handle customer signature for contract
router.post('/:id/customer-signature', async (req, res) => {
 try {
 const contractId = req.params.id;
 const { clientSignature, clientDate, signedTimestamp, ipAddress } = req.body;
 
 console.log(` Processing customer signature for contract ${contractId}...`);
 console.log('Signature data:', { 
 clientSignature: clientSignature ? '[PROVIDED]' : '[MISSING]', 
 clientDate, 
 signedTimestamp, 
 ipAddress: ipAddress || 'Unknown',
 userAgent: req.get('User-Agent') || 'Unknown',
 referer: req.get('Referer') || 'Unknown'
 });
 
 // Validate required fields
 if (!clientSignature || !clientSignature.trim()) {
 console.log('❌ Missing client signature');
 return res.status(400).json({ 
 error: 'Client signature is required',
 field: 'clientSignature'
 });
 }
 
 if (!clientDate) {
 console.log('❌ Missing client date');
 return res.status(400).json({ 
 error: 'Signature date is required',
 field: 'clientDate'
 });
 }
 
 // Sanitize and validate contract ID
 const contractIdInt = parseInt(contractId);
 if (isNaN(contractIdInt) || contractIdInt <= 0) {
 console.log('❌ Invalid contract ID:', contractId);
 return res.status(400).json({ 
 error: 'Invalid contract ID',
 field: 'contractId'
 });
 }
 
 // First, get the current contract to verify it exists and isn't already signed
 console.log('🔍 Looking up contract details...');
 const contractResult = await database.query(`
 SELECT c.ContractID, c.ContractNumber, c.ContractStatus,
 p.ProjectName,
 cust.CompanyName, cust.ContactName, cust.Email
 FROM Contracts c
 INNER JOIN Projects p ON c.ProjectID = p.ProjectID
 INNER JOIN Customers cust ON p.CustomerID = cust.CustomerID
 WHERE c.ContractID = @contractId
 `, { contractId: contractIdInt });

 if (contractResult.recordset.length === 0) {
 console.log('❌ Contract not found:', contractIdInt);
 return res.status(404).json({ 
 error: 'Contract not found. Please check the contract link.',
 contractId: contractIdInt
 });
 }

 const contract = contractResult.recordset[0];
 console.log('✅ Contract found:', {
 contractNumber: contract.ContractNumber,
 projectName: contract.ProjectName,
 customer: contract.CompanyName,
 status: contract.ContractStatus
 });

 if (contract.ContractStatus === 'Signed') {
 console.log('❌ Contract already signed');
 return res.status(400).json({ 
 error: 'Contract is already signed',
 contractNumber: contract.ContractNumber,
 status: contract.ContractStatus
 });
 }
 
 // Prepare signature data with fallbacks
 const finalIpAddress = ipAddress || req.ip || req.connection.remoteAddress || 'Unknown';
 const signatureTimestamp = new Date();
 
 console.log('💾 Updating contract with signature...');
 
 // Update the contract with signature information
 const updateResult = await database.query(`
 UPDATE Contracts 
 SET ContractStatus = 'Signed',
 SignedDate = @signedDate,
 ModifiedDate = @modifiedDate,
 ClientSignature = @clientSignature,
 ClientSignatureDate = @clientDate,
 SignatureIPAddress = @ipAddress
 WHERE ContractID = @contractId
 `, {
 contractId: contractIdInt,
 clientSignature: clientSignature.trim(),
 clientDate,
 ipAddress: finalIpAddress,
 signedDate: signatureTimestamp,
 modifiedDate: signatureTimestamp
 });

 console.log(`✅ Contract ${contractIdInt} successfully signed by customer`);
 console.log('✅ Signature details:', {
 contractNumber: contract.ContractNumber,
 customerName: contract.CompanyName,
 signedTimestamp: signatureTimestamp,
 ipAddress: finalIpAddress
 });
 
 // Verify the update worked by checking the updated record
 const verifyResult = await database.query(`
 SELECT ContractID, ContractNumber, ContractStatus, SignedDate, 
 ClientSignature, ClientSignatureDate, SignatureIPAddress
 FROM Contracts 
 WHERE ContractID = @contractId
 `, { contractId: contractIdInt });
 
 if (verifyResult.recordset.length > 0) {
 console.log('✅ Database update verified:', verifyResult.recordset[0]);
 }
 
 // TODO: Send email notification to company about signed contract
 // await sendContractSignedNotification(contract);
 
 res.json({
 success: true,
 message: 'Contract signed successfully',
 contractId: contractIdInt,
 contractNumber: contract.ContractNumber,
 signedDate: signatureTimestamp,
 status: 'Signed',
 customer: contract.CompanyName,
 projectName: contract.ProjectName
 });
 
 } catch (error) {
 console.error('❌ Error processing customer signature:', error);
 console.error('❌ Error stack:', error.stack);
 
 // Provide more specific error messages based on error type
 let errorMessage = 'Failed to sign contract';
 let statusCode = 500;
 
 if (error.message.includes('FOREIGN KEY')) {
 errorMessage = 'Contract data integrity error';
 statusCode = 400;
 } else if (error.message.includes('timeout')) {
 errorMessage = 'Database timeout - please try again';
 statusCode = 503;
 } else if (error.message.includes('duplicate')) {
 errorMessage = 'Contract is already signed';
 statusCode = 400;
 }
 
 res.status(statusCode).json({ 
 success: false,
 error: errorMessage, 
 details: process.env.NODE_ENV === 'development' ? error.message : undefined,
 timestamp: new Date().toISOString()
 });
 }
});

// Create new contract
router.post('/', async (req, res) => {
 try {
 const { ProjectID, ContractType, ContractAmount, ContractStatus } = req.body;
 
 if (!ProjectID) {
 return res.status(400).json({ error: 'Project ID is required' });
 }
 
 // Auto-generate contract number
 const contractNumber = await generateContractNumber();
 
 const result = await database.query(`
 INSERT INTO Contracts (ProjectID, ContractNumber, ContractType, ContractAmount, ContractStatus)
 OUTPUT INSERTED.ContractID, INSERTED.ProjectID, INSERTED.ContractNumber,
 INSERTED.ContractType, INSERTED.ContractAmount, INSERTED.ContractStatus,
 INSERTED.SignedDate, INSERTED.CreatedDate, INSERTED.ModifiedDate
 VALUES (@projectId, @contractNumber, @contractType, @contractAmount, @contractStatus)
 `, {
 projectId: ProjectID,
 contractNumber: contractNumber,
 contractType: ContractType || 'Design Contract',
 contractAmount: ContractAmount || null,
 contractStatus: ContractStatus || 'Draft'
 });
 
 res.status(201).json(result.recordset[0]);
 } catch (error) {
 console.error('Error creating contract:', error);
 res.status(500).json({ error: 'Failed to create contract' });
 }
});

// Delete contract by ID (prevent deletion if signed)
router.delete('/:id', async (req, res) => {
 try {
 const contractId = req.params.id;
 // Check if contract is signed
 const result = await database.query(`
 SELECT ContractStatus FROM Contracts WHERE ContractID = @contractId
 `, { contractId });
 if (result.recordset.length === 0) {
 return res.status(404).json({ error: 'Contract not found' });
 }
 if (result.recordset[0].ContractStatus === 'Signed') {
 return res.status(400).json({ error: 'Cannot delete a signed contract.' });
 }
 // Delete contract
 await database.query(`DELETE FROM Contracts WHERE ContractID = @contractId`, { contractId });
 res.status(204).send();
 } catch (error) {
 console.error('Error deleting contract:', error);
 res.status(500).json({ error: 'Failed to delete contract' });
 }
});

// Function to generate unique contract number
async function generateContractNumber() {
 try {
 // Get the latest contract number to increment
 const result = await database.query(`
 SELECT TOP 1 ContractNumber 
 FROM Contracts 
 WHERE ContractNumber LIKE 'CON-%'
 ORDER BY CreatedDate DESC
 `);
 
 let nextNumber = 1;
 if (result.recordset.length > 0) {
 const lastNumber = result.recordset[0].ContractNumber;
 const numberPart = lastNumber.split('-')[1];
 nextNumber = parseInt(numberPart) + 1;
 }
 
 return `CON-${nextNumber.toString().padStart(4, '0')}`;
 } catch (error) {
 console.error('Error generating contract number:', error);
 // Fallback to timestamp-based number
 return `CON-${Date.now().toString().slice(-4)}`;
 }
}

module.exports = router;
