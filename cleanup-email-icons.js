const fs = require('fs');

// Read the contracts file
let fileContent = fs.readFileSync('routes/contracts.js', 'utf8');

// Fix corrupted settingsHelper import line - just in case
fileContent = fileContent.replace(
    /const settingsHelper = require\('\.\.\/utils\/settin.*?sHelper'\);/g,
    "const settingsHelper = require('../utils/settingsHelper');"
);

// Remove all clipboard, document, pencil, email, and phone emojis from the email template
fileContent = fileContent.replace(/📋/g, '');  // clipboard
fileContent = fileContent.replace(/📄/g, '');  // document
fileContent = fileContent.replace(/📝/g, '');  // pencil/memo
fileContent = fileContent.replace(/📧/g, '');  // email
fileContent = fileContent.replace(/📞/g, '');  // phone
fileContent = fileContent.replace(/�/g, '');   // corrupted phone character

// Clean up any double spaces left by removed emojis
fileContent = fileContent.replace(/  +/g, ' ');

// Write back the cleaned file
fs.writeFileSync('routes/contracts.js', fileContent);

console.log('✅ Cleaned up all emoji icons from contract email template');
console.log('📋 Clipboard icons removed');  
console.log('📄 Document icons removed');
console.log('📝 Pencil icons removed');
console.log('📧 Email icons removed');
console.log('📞 Phone icons removed');
console.log('✨ Contract email template is now clean and professional!');
