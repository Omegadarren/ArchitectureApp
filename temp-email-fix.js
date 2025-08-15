// Corrected email functions for contracts.js

const { sendEmail } = require('../config/email');

// Email function for customer contract signing
async function sendCustomerContractEmail(contract, signingUrl) {
    try {
        const subject = `Contract Ready for Your Signature - ${contract.ContractNumber}`;
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #007bff; margin: 0; font-size: 2rem;">OMEGA BUILDERS, LLC</h1>
                        <div style="height: 2px; background: #007bff; margin: 15px auto; width: 200px;"></div>
                    </div>
                    
                    <h2 style="color: #495057;">Contract Ready for Your Digital Signature</h2>
                    
                    <p>Dear ${contract.ContactName},</p>
                    
                    <p>Your design contract for <strong>${contract.ProjectName}</strong> is ready for your digital signature.</p>
                    
                    <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 1.1rem;"><strong>Contract Number:</strong> ${contract.ContractNumber}</p>
                        <p style="margin: 10px 0 0 0;"><strong>Project:</strong> ${contract.ProjectName}</p>
                    </div>
                    
                    <p><strong>To sign your contract:</strong></p>
                    <ol>
                        <li>Click the link below to access the contract signing page</li>
                        <li>Review the contract details carefully</li>
                        <li>Check the signature agreement checkbox</li>
                        <li>Type your full legal name in the client signature field</li>
                        <li>Click "Save Signed Contract" to complete the process</li>
                    </ol>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${signingUrl}" style="display: inline-block; background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 1.1rem;">
                            🖊️ SIGN CONTRACT NOW
                        </a>
                    </div>
                    
                    <div style="background-color: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; color: #856404;"><strong>Important:</strong> Once you sign the contract, both parties will automatically receive a copy via email. Please keep this for your records.</p>
                    </div>
                    
                    <p>If you have any questions about the contract, please don't hesitate to contact us.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 0.9rem;">
                        <p style="margin: 0;"><strong>Omega Builders, LLC</strong></p>
                        <p style="margin: 5px 0;">Email: info@omegabuilders.com</p>
                        <p style="margin: 5px 0;">This email was sent regarding contract ${contract.ContractNumber}</p>
                    </div>
                </div>
            </div>
        `;

        const result = await sendEmail(contract.Email, subject, htmlContent);
        console.log('Email send result:', result);
        return result.success;
    } catch (error) {
        console.error('❌ Error sending customer contract email:', error);
        return false;
    }
}

module.exports = { sendCustomerContractEmail };
