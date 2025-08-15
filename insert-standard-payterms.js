const database = require('./config/database');

async function insertStandardPayTerms() {
    try {
        await database.connect();
        console.log('Connected to database');

        // First, let's check if we have any projects and estimates to work with
        const projectsResult = await database.query(`
            SELECT TOP 1 p.ProjectID, p.ProjectName, e.EstimateID, e.TotalAmount
            FROM Projects p
            INNER JOIN Estimates e ON p.ProjectID = e.ProjectID
            ORDER BY p.ProjectID DESC
        `);

        if (projectsResult.recordset.length === 0) {
            console.log('No projects with estimates found. Please create a project and estimate first.');
            return;
        }

        const project = projectsResult.recordset[0];
        console.log(`Using project: ${project.ProjectName} (ID: ${project.ProjectID})`);
        console.log(`Using estimate with total: $${project.TotalAmount}`);

        // Clear existing pay terms for this project to avoid duplicates
        await database.query(`
            DELETE FROM PayTerms WHERE ProjectID = @projectId
        `, { projectId: project.ProjectID });

        // Insert the three standard pay term options

        // Option 1: 100% due at contract acceptance
        const result1 = await database.query(`
            INSERT INTO PayTerms (ProjectID, EstimateID, PayTermType, PayTermName, 
                                PercentageAmount, FixedAmount, PayTermDescription, PayTermStatus)
            VALUES (@projectId, @estimateId, @payTermType, @payTermName, 
                    @percentageAmount, @fixedAmount, @payTermDescription, @payTermStatus)
        `, {
            projectId: project.ProjectID,
            estimateId: project.EstimateID,
            payTermType: 'Contract Acceptance',
            payTermName: 'Due at contract acceptance',
            percentageAmount: 100,
            fixedAmount: project.TotalAmount,
            payTermDescription: '100% of estimate total due at contract acceptance',
            payTermStatus: 'Pending'
        });

        console.log('✓ Added: 100% due at contract acceptance');

        // Option 2: 75% at acceptance, 25% at permit submittal
        const firstPayment = project.TotalAmount * 0.75;
        const secondPayment = project.TotalAmount * 0.25;

        const result2a = await database.query(`
            INSERT INTO PayTerms (ProjectID, EstimateID, PayTermType, PayTermName, 
                                PercentageAmount, FixedAmount, PayTermDescription, PayTermStatus)
            VALUES (@projectId, @estimateId, @payTermType, @payTermName, 
                    @percentageAmount, @fixedAmount, @payTermDescription, @payTermStatus)
        `, {
            projectId: project.ProjectID,
            estimateId: project.EstimateID,
            payTermType: 'Contract Acceptance',
            payTermName: 'Due at contract acceptance (75%)',
            percentageAmount: 75,
            fixedAmount: firstPayment,
            payTermDescription: '75% of estimate total due at contract acceptance',
            payTermStatus: 'Pending'
        });

        const result2b = await database.query(`
            INSERT INTO PayTerms (ProjectID, EstimateID, PayTermType, PayTermName, 
                                PercentageAmount, FixedAmount, PayTermDescription, PayTermStatus)
            VALUES (@projectId, @estimateId, @payTermType, @payTermName, 
                    @percentageAmount, @fixedAmount, @payTermDescription, @payTermStatus)
        `, {
            projectId: project.ProjectID,
            estimateId: project.EstimateID,
            payTermType: 'Permit Submittal',
            payTermName: 'Due prior to permit submittal (25%)',
            percentageAmount: 25,
            fixedAmount: secondPayment,
            payTermDescription: '25% of estimate total (remaining balance) due prior to permit submittal or submittal to engineer',
            payTermStatus: 'Pending'
        });

        console.log('✓ Added: 75% at contract acceptance + 25% at permit submittal');

        // Let's also create a sample for another project if available
        const allProjectsResult = await database.query(`
            SELECT p.ProjectID, p.ProjectName, e.EstimateID, e.TotalAmount
            FROM Projects p
            INNER JOIN Estimates e ON p.ProjectID = e.ProjectID
            WHERE p.ProjectID != @excludeProjectId
            ORDER BY p.ProjectID DESC
        `, { excludeProjectId: project.ProjectID });

        if (allProjectsResult.recordset.length > 0) {
            const secondProject = allProjectsResult.recordset[0];
            console.log(`\nAdding pay terms for second project: ${secondProject.ProjectName}`);

            // Add 100% option for second project
            await database.query(`
                INSERT INTO PayTerms (ProjectID, EstimateID, PayTermType, PayTermName, 
                                    PercentageAmount, FixedAmount, PayTermDescription, PayTermStatus)
                VALUES (@projectId, @estimateId, @payTermType, @payTermName, 
                        @percentageAmount, @fixedAmount, @payTermDescription, @payTermStatus)
            `, {
                projectId: secondProject.ProjectID,
                estimateId: secondProject.EstimateID,
                payTermType: 'Contract Acceptance',
                payTermName: 'Due at contract acceptance',
                percentageAmount: 100,
                fixedAmount: secondProject.TotalAmount,
                payTermDescription: '100% of estimate total due at contract acceptance',
                payTermStatus: 'Pending'
            });

            console.log('✓ Added 100% option for second project');
        }

        console.log('\nStandard pay terms inserted successfully!');

    } catch (error) {
        console.error('Error inserting standard pay terms:', error);
    } finally {
        await database.close();
        console.log('Database connection closed');
    }
}

// Run the function
insertStandardPayTerms();
