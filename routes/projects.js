const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Get all projects with customer info
router.get('/', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT p.ProjectID, p.ProjectName, p.ProjectDescription, p.ProjectAddress, 
                   p.ProjectCity, p.ProjectState, p.ProjectZip, p.StartDate, 
                   p.EstimatedCompletionDate, p.ActualCompletionDate, p.ProjectStatus, 
                   p.TotalContractAmount, p.ProjectPriority, p.CreatedDate, p.ModifiedDate,
                   p.ProjectContactName, p.ProjectContactPhone, p.ProjectContactEmail,
                   c.CustomerID, c.CompanyName, c.ContactName
            FROM Projects p
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            ORDER BY p.CreatedDate DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Get single project by ID with customer info
router.get('/:id', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT p.ProjectID, p.ProjectName, p.ProjectDescription, p.ProjectAddress, 
                   p.ProjectCity, p.ProjectState, p.ProjectZip, p.StartDate, 
                   p.EstimatedCompletionDate, p.ActualCompletionDate, p.ProjectStatus, 
                   p.TotalContractAmount, p.CreatedDate, p.ModifiedDate,
                   p.ProjectContactName, p.ProjectContactPhone, p.ProjectContactEmail,
                   c.CustomerID, c.CompanyName, c.ContactName, c.Phone, c.Email
            FROM Projects p
            INNER JOIN Customers c ON p.CustomerID = c.CustomerID
            WHERE p.ProjectID = @projectId
        `, { projectId: req.params.id });
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Create new project
router.post('/', async (req, res) => {
    try {
        console.log('Received project POST body:', req.body);
        const { 
            CustomerID, ProjectName, ProjectDescription, ProjectAddress, 
            ProjectCity, ProjectState, ProjectZip, StartDate, 
            EstimatedCompletionDate, ProjectStatus, TotalContractAmount, ProjectPriority,
            ProjectContactName, ProjectContactPhone, ProjectContactEmail
        } = req.body;
        
        if (!CustomerID || !ProjectName) {
            return res.status(400).json({ error: 'Customer ID and project name are required' });
        }
        
        const result = await database.query(`
            INSERT INTO Projects (CustomerID, ProjectName, ProjectDescription, ProjectAddress, 
                                ProjectCity, ProjectState, ProjectZip, StartDate, 
                                EstimatedCompletionDate, ProjectStatus, TotalContractAmount, ProjectPriority,
                                ProjectContactName, ProjectContactPhone, ProjectContactEmail)
            OUTPUT INSERTED.ProjectID, INSERTED.CustomerID, INSERTED.ProjectName, 
                   INSERTED.ProjectDescription, INSERTED.ProjectAddress, INSERTED.ProjectCity, 
                   INSERTED.ProjectState, INSERTED.ProjectZip, INSERTED.StartDate, 
                   INSERTED.EstimatedCompletionDate, INSERTED.ActualCompletionDate, 
                   INSERTED.ProjectStatus, INSERTED.TotalContractAmount, INSERTED.ProjectPriority,
                   INSERTED.ProjectContactName, INSERTED.ProjectContactPhone, INSERTED.ProjectContactEmail,
                   INSERTED.CreatedDate, INSERTED.ModifiedDate
            VALUES (@customerId, @projectName, @projectDescription, @projectAddress, 
                    @projectCity, @projectState, @projectZip, @startDate, 
                    @estimatedCompletionDate, @projectStatus, @totalContractAmount, @projectPriority,
                    @projectContactName, @projectContactPhone, @projectContactEmail)
        `, {
            customerId: CustomerID,
            projectName: ProjectName,
            projectDescription: ProjectDescription || null,
            projectAddress: ProjectAddress || null,
            projectCity: ProjectCity || null,
            projectState: ProjectState || null,
            projectZip: ProjectZip || null,
            startDate: StartDate || null,
            estimatedCompletionDate: EstimatedCompletionDate || null,
            projectStatus: ProjectStatus || 'Planning',
            totalContractAmount: TotalContractAmount || null,
            projectPriority: parseInt(ProjectPriority) || 0,
            projectContactName: ProjectContactName || null,
            projectContactPhone: ProjectContactPhone || null,
            projectContactEmail: ProjectContactEmail || null
        });
        
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Update project
router.put('/:id', async (req, res) => {
    try {
        const { 
            ProjectName, ProjectDescription, ProjectAddress, 
            ProjectCity, ProjectState, ProjectZip, StartDate, 
            EstimatedCompletionDate, ActualCompletionDate, 
            ProjectStatus, TotalContractAmount, ProjectPriority,
            ProjectContactName, ProjectContactPhone, ProjectContactEmail
        } = req.body;
        
        if (!ProjectName) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        
        const result = await database.query(`
            UPDATE Projects 
            SET ProjectName = @projectName, 
                ProjectDescription = @projectDescription, 
                ProjectAddress = @projectAddress, 
                ProjectCity = @projectCity, 
                ProjectState = @projectState, 
                ProjectZip = @projectZip, 
                StartDate = @startDate, 
                EstimatedCompletionDate = @estimatedCompletionDate, 
                ActualCompletionDate = @actualCompletionDate, 
                ProjectStatus = @projectStatus, 
                TotalContractAmount = @totalContractAmount,
                ProjectPriority = @projectPriority,
                ProjectContactName = @projectContactName,
                ProjectContactPhone = @projectContactPhone,
                ProjectContactEmail = @projectContactEmail,
                ModifiedDate = GETDATE()
            OUTPUT INSERTED.ProjectID, INSERTED.CustomerID, INSERTED.ProjectName, 
                   INSERTED.ProjectDescription, INSERTED.ProjectAddress, INSERTED.ProjectCity, 
                   INSERTED.ProjectState, INSERTED.ProjectZip, INSERTED.StartDate, 
                   INSERTED.EstimatedCompletionDate, INSERTED.ActualCompletionDate, 
                   INSERTED.ProjectStatus, INSERTED.TotalContractAmount, INSERTED.ProjectPriority,
                   INSERTED.ProjectContactName, INSERTED.ProjectContactPhone, INSERTED.ProjectContactEmail,
                   INSERTED.CreatedDate, INSERTED.ModifiedDate
            WHERE ProjectID = @projectId
        `, {
            projectId: req.params.id,
            projectName: ProjectName,
            projectDescription: ProjectDescription || null,
            projectAddress: ProjectAddress || null,
            projectCity: ProjectCity || null,
            projectState: ProjectState || null,
            projectZip: ProjectZip || null,
            startDate: StartDate || null,
            estimatedCompletionDate: EstimatedCompletionDate || null,
            actualCompletionDate: ActualCompletionDate || null,
            projectStatus: ProjectStatus || 'Planning',
            totalContractAmount: TotalContractAmount || null,
            projectPriority: parseInt(ProjectPriority) || 0,
            projectContactName: ProjectContactName || null,
            projectContactPhone: ProjectContactPhone || null,
            projectContactEmail: ProjectContactEmail || null
        });
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Delete project
router.delete('/:id', async (req, res) => {
    try {
        // Check for related records
        const relatedCheck = await database.query(`
            SELECT 
                (SELECT COUNT(*) FROM Estimates WHERE ProjectID = @projectId) as estimateCount,
                (SELECT COUNT(*) FROM Invoices WHERE ProjectID = @projectId) as invoiceCount,
                (SELECT COUNT(*) FROM ChangeOrders WHERE ProjectID = @projectId) as changeOrderCount,
                (SELECT COUNT(*) FROM Contracts WHERE ProjectID = @projectId) as contractCount
        `, { projectId: req.params.id });
        
        const counts = relatedCheck.recordset[0];
        if (counts.estimateCount > 0 || counts.invoiceCount > 0 || 
            counts.changeOrderCount > 0 || counts.contractCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete project with associated estimates, invoices, change orders, or contracts. Delete those first.' 
            });
        }
        
        const result = await database.query(`
            DELETE FROM Projects WHERE ProjectID = @projectId
        `, { projectId: req.params.id });
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Get project estimates
router.get('/:id/estimates', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT EstimateID, EstimateNumber, EstimateDate, ValidUntilDate, 
                   SubTotal, TaxRate, TaxAmount, TotalAmount, EstimateStatus, 
                   Notes, CreatedDate, ModifiedDate
            FROM Estimates 
            WHERE ProjectID = @projectId
            ORDER BY CreatedDate DESC
        `, { projectId: req.params.id });
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching project estimates:', error);
        res.status(500).json({ error: 'Failed to fetch project estimates' });
    }
});

// Get project invoices
router.get('/:id/invoices', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT InvoiceID, InvoiceNumber, InvoiceDate, DueDate, 
                   SubTotal, TaxRate, TaxAmount, TotalAmount, PaidAmount, 
                   (TotalAmount - PaidAmount) as BalanceDue, InvoiceStatus, 
                   Notes, CreatedDate, ModifiedDate
            FROM Invoices 
            WHERE ProjectID = @projectId
            ORDER BY CreatedDate DESC
        `, { projectId: req.params.id });
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching project invoices:', error);
        res.status(500).json({ error: 'Failed to fetch project invoices' });
    }
});

// Get project change orders
router.get('/:id/changeorders', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT ChangeOrderID, ChangeOrderNumber, ChangeOrderDate, Description, 
                   Reason, SubTotal, TaxRate, TaxAmount, TotalAmount, 
                   ChangeOrderStatus, ApprovedDate, Notes, CreatedDate, ModifiedDate
            FROM ChangeOrders 
            WHERE ProjectID = @projectId
            ORDER BY CreatedDate DESC
        `, { projectId: req.params.id });
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching project change orders:', error);
        res.status(500).json({ error: 'Failed to fetch project change orders' });
    }
});

// Get project contracts
router.get('/:id/contracts', async (req, res) => {
    try {
        const result = await database.query(`
            SELECT ContractID, ContractType, ContractNumber, ContractDate, 
                   ContractStatus, ContractAmount, SignedDate, ContractTerms, 
                   SpecialConditions, CreatedDate, ModifiedDate
            FROM Contracts 
            WHERE ProjectID = @projectId
            ORDER BY CreatedDate DESC
        `, { projectId: req.params.id });
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching project contracts:', error);
        res.status(500).json({ error: 'Failed to fetch project contracts' });
    }
});

module.exports = router;