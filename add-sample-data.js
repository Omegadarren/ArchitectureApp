const db = require('./config/database.js');

async function addSampleData() {
    try {
        await db.connect();
        
        console.log('🏗️ Adding sample data to Architecture Project Management System...');
        
        // Sample Customers
        const customers = [
            {
                CompanyName: 'Sharpe & LLC',
                ContactName: 'John Sharpe',
                Email: 'john@sharpellc.com',
                Phone: '(555) 123-4567',
                Address: '123 Business Ave',
                City: 'New York',
                State: 'NY',
                ZipCode: '10001'
            },
            {
                CompanyName: 'Romaine Residence',
                ContactName: 'Dan Romaine',
                Email: 'dan.romaine@email.com',
                Phone: '(555) 987-6543',
                ContactName2: 'Kathy Romaine',
                Phone2: '(555) 987-6544',
                Address: '456 Oak Street',
                City: 'Los Angeles',
                State: 'CA',
                ZipCode: '90210'
            },
            {
                CompanyName: 'Modern Designs Inc',
                ContactName: 'Sarah Johnson',
                Email: 'sarah@moderndesigns.com',
                Phone: '(555) 456-7890',
                Address: '789 Design Blvd',
                City: 'Chicago',
                State: 'IL',
                ZipCode: '60601'
            }
        ];
        
        // Insert customers
        for (let customer of customers) {
            await db.query(`
                INSERT INTO Customers (CompanyName, ContactName, Email, Phone, ContactName2, Phone2, Address, City, State, ZipCode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                customer.CompanyName,
                customer.ContactName,
                customer.Email,
                customer.Phone,
                customer.ContactName2 || '',
                customer.Phone2 || '',
                customer.Address,
                customer.City,
                customer.State,
                customer.ZipCode
            ]);
        }
        
        console.log('✅ Added 3 sample customers');
        
        // Sample Projects
        const projects = [
            {
                CustomerID: 1,
                ProjectName: 'Office Building Renovation',
                ProjectDescription: 'Complete renovation of 3-story office building including HVAC, electrical, and interior design',
                ProjectAddress: '123 Business Ave',
                ProjectCity: 'New York',
                ProjectState: 'NY',
                ProjectZip: '10001',
                StartDate: '2024-01-15',
                EstimatedCompletionDate: '2024-06-30',
                ProjectStatus: 'Needs Attention',
                ProjectPriority: 1,
                TotalContractAmount: 150000.00
            },
            {
                CustomerID: 2,
                ProjectName: 'Custom Home Addition',
                ProjectDescription: 'Two-story addition with master suite and family room',
                ProjectAddress: '456 Oak Street',
                ProjectCity: 'Los Angeles',
                ProjectState: 'CA',
                ProjectZip: '90210',
                StartDate: '2024-02-01',
                EstimatedCompletionDate: '2024-08-15',
                ProjectStatus: 'Awaiting Engineering',
                ProjectPriority: 0,
                TotalContractAmount: 85000.00
            },
            {
                CustomerID: 3,
                ProjectName: 'Modern Kitchen Remodel',
                ProjectDescription: 'Complete kitchen renovation with custom cabinetry and high-end appliances',
                ProjectAddress: '789 Design Blvd',
                ProjectCity: 'Chicago',
                ProjectState: 'IL',
                ProjectZip: '60601',
                StartDate: '2024-03-01',
                EstimatedCompletionDate: '2024-05-30',
                ProjectStatus: 'Needs Attention',
                ProjectPriority: 2,
                TotalContractAmount: 45000.00
            }
        ];
        
        // Insert projects
        for (let project of projects) {
            await db.query(`
                INSERT INTO Projects (
                    CustomerID, ProjectName, ProjectDescription, ProjectAddress, 
                    ProjectCity, ProjectState, ProjectZip, StartDate, 
                    EstimatedCompletionDate, ProjectStatus, ProjectPriority, TotalContractAmount
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                project.CustomerID,
                project.ProjectName,
                project.ProjectDescription,
                project.ProjectAddress,
                project.ProjectCity,
                project.ProjectState,
                project.ProjectZip,
                project.StartDate,
                project.EstimatedCompletionDate,
                project.ProjectStatus,
                project.ProjectPriority,
                project.TotalContractAmount
            ]);
        }
        
        console.log('✅ Added 3 sample projects');
        
        // Sample Estimates
        const estimates = [
            {
                ProjectID: 1,
                EstimateNumber: 'EST-0001',
                EstimateDate: '2024-01-10',
                TotalAmount: 150000.00,
                Status: 'Approved'
            },
            {
                ProjectID: 2,
                EstimateNumber: 'EST-0002',
                EstimateDate: '2024-01-25',
                TotalAmount: 85000.00,
                Status: 'Pending'
            },
            {
                ProjectID: 3,
                EstimateNumber: 'EST-0003',
                EstimateDate: '2024-02-20',
                TotalAmount: 45000.00,
                Status: 'Draft'
            }
        ];
        
        // Insert estimates
        for (let estimate of estimates) {
            await db.query(`
                INSERT INTO Estimates (ProjectID, EstimateNumber, EstimateDate, TotalAmount, Status)
                VALUES (?, ?, ?, ?, ?)
            `, [
                estimate.ProjectID,
                estimate.EstimateNumber,
                estimate.EstimateDate,
                estimate.TotalAmount,
                estimate.Status
            ]);
        }
        
        console.log('✅ Added 3 sample estimates');
        
        // Verify the data
        const customerCount = await db.query('SELECT COUNT(*) as count FROM Customers');
        const projectCount = await db.query('SELECT COUNT(*) as count FROM Projects');
        const estimateCount = await db.query('SELECT COUNT(*) as count FROM Estimates');
        
        console.log('\n📊 Database Summary:');
        console.log(`- Customers: ${customerCount.recordset[0].count}`);
        console.log(`- Projects: ${projectCount.recordset[0].count}`);
        console.log(`- Estimates: ${estimateCount.recordset[0].count}`);
        console.log('\n🎉 Sample data added successfully!');
        console.log('You can now login with admin/admin and see the sample data.');
        
        await db.close();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error adding sample data:', error);
        process.exit(1);
    }
}

addSampleData();
