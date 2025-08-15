// Test email button visibility across browsers
const fs = require('fs');

async function testEmailButton() {
    try {
        // Mock contract data
        const contract = {
            ContractNumber: 'CON-0001',
            ProjectName: 'Test Design Project',
            ProjectAddress: '123 Test Street',
            ProjectCity: 'Test City',
            ProjectState: 'WA',
            CompanyName: 'Test Client LLC',
            ContactName: 'John Doe',
            ContractAmount: 5000,
            ContractID: 1
        };

        console.log('✅ Using mock contract:', contract.ContractNumber);

        const settings = {
            company_name: 'Omega Builders, LLC',
            company_address: '1934 Florence St, Enumclaw, WA 98022',
            company_email: 'info@omegabuilders.com',
            company_phone: '(555) 123-4567'
        };
        
        const signingUrl = `http://localhost:3000/contract-signing/${contract.ContractID}`;

        const formatCurrency = (amount) => {
            if (!amount) return '$0.00';
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2
            }).format(amount);
        };

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
        .sign-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%); 
            color: white !important; 
            padding: 18px 40px; 
            text-decoration: none !important; 
            border-radius: 30px; 
            font-weight: bold; 
            font-size: 1.2rem;
            box-shadow: 0 6px 12px rgba(40, 167, 69, 0.4);
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            border: none;
            cursor: pointer;
        }
        .sign-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 16px rgba(40, 167, 69, 0.6);
            background: linear-gradient(135deg, #218838 0%, #1c7430 100%);
            color: white !important;
            text-decoration: none !important;
        }
        .sign-button:visited {
            color: white !important;
        }
        .sign-button:active {
            color: white !important;
        }
        .sign-button:link {
            color: white !important;
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
                <p>Your design contract is ready for your digital signature. Below is a summary of your contract details. When you click the button below, you'll see the complete contract with all terms and conditions.</p>
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
                <a href="${signingUrl}" class="sign-button">
                    Ready to proceed? Click here to review the full contract and sign
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>${settings.company_name || 'Omega Builders, LLC'}</strong></p>
            <p>${settings.company_address || '1934 Florence St, Enumclaw, WA 98022'}</p>
            <p>${settings.company_email || 'info@omegabuilders.com'} | ${settings.company_phone || '(555) 123-4567'}</p>
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

        // Save the HTML to a file for testing
        fs.writeFileSync('test-email-button.html', htmlContent);
        console.log('✅ Email HTML saved to test-email-button.html');
        console.log('📧 You can open this file in different browsers to test button visibility');
        console.log('🔗 Button URL:', signingUrl);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testEmailButton();
