const database = require('./config/database');

async function testEmailWithMissingLocation() {
    try {
        // Check what data we have in projects
        const result = await database.query(`
            SELECT ProjectID, ProjectName, ProjectAddress, ProjectCity, ProjectState 
            FROM Projects 
            ORDER BY ProjectID
        `);
        
        console.log('📋 All Project Location Data:');
        result.recordset.forEach(project => {
            const locationDisplay = `${project.ProjectAddress || 'Project Address'}${project.ProjectCity || project.ProjectState ? ', ' + [project.ProjectCity, project.ProjectState].filter(Boolean).join(' ') : ''}`;
            console.log(`Project ${project.ProjectID}: ${locationDisplay}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

testEmailWithMissingLocation();
