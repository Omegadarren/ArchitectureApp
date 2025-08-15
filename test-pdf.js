// Simple test to verify Puppeteer works
const puppeteer = require('puppeteer');

async function testPuppeteer() {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        console.log('Setting simple HTML content...');
        
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test PDF</title>
            </head>
            <body>
                <h1>Hello World!</h1>
                <p>This is a test PDF.</p>
                <table border="1">
                    <tr><td>Test</td><td>Data</td></tr>
                </table>
            </body>
            </html>
        `);
        
        console.log('Generating PDF...');
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true
        });
        
        await browser.close();
        
        console.log('PDF generated successfully!');
        console.log('PDF size:', pdf.length, 'bytes');
        
        // Save to file
        require('fs').writeFileSync('test.pdf', pdf);
        console.log('PDF saved as test.pdf');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testPuppeteer();
