const fetch = require('node-fetch');

async function testContractGeneration() {
    try {
        // First, get a list of projects
        console.log('Fetching projects...');
        const projectsResponse = await fetch('http://localhost:3000/api/projects');
        const projects = await projectsResponse.json();
        
        if (projects.length === 0) {
            console.log('No projects found. Cannot test contract generation.');
            return;
        }
        
        const firstProject = projects[0];
        console.log(`Found project: ${firstProject.ProjectName} (ID: ${firstProject.ProjectID})`);
        
        // Try to generate HTML contract
        console.log('Testing HTML contract generation...');
        const htmlResponse = await fetch(`http://localhost:3000/api/contracts/generate-html/${firstProject.ProjectID}`);
        
        if (htmlResponse.ok) {
            console.log('✓ HTML contract generation endpoint is working');
        } else {
            console.log('✗ HTML contract generation failed:', htmlResponse.status, htmlResponse.statusText);
            const errorText = await htmlResponse.text();
            console.log('Error details:', errorText);
        }
        
        // Try to generate PDF contract
        console.log('Testing PDF contract generation...');
        const pdfResponse = await fetch(`http://localhost:3000/api/contracts/generate-pdf/${firstProject.ProjectID}`);
        
        if (pdfResponse.ok) {
            console.log('✓ PDF contract generation endpoint is working');
        } else {
            console.log('✗ PDF contract generation failed:', pdfResponse.status, pdfResponse.statusText);
            const errorText = await pdfResponse.text();
            console.log('Error details:', errorText);
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testContractGeneration();
