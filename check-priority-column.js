const database = require('./config/database');

async function checkAndAddPriorityColumn() {
    try {
        console.log('Checking if ProjectPriority column exists...');
        
        // First, try to select ProjectPriority to see if column exists
        try {
            const testResult = await database.query('SELECT TOP 1 ProjectPriority FROM Projects');
            console.log('✅ ProjectPriority column already exists');
            return;
        } catch (error) {
            if (error.message.includes("Invalid column name 'ProjectPriority'")) {
                console.log('❌ ProjectPriority column does not exist. Adding it...');
                
                // Add the column
                await database.query('ALTER TABLE Projects ADD ProjectPriority INT DEFAULT 0');
                console.log('✅ ProjectPriority column added successfully');
                
                // Verify it was added
                const verifyResult = await database.query('SELECT TOP 1 ProjectPriority FROM Projects');
                console.log('✅ Column verified - it works!');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error checking/adding ProjectPriority column:', error);
    } finally {
        process.exit(0);
    }
}

checkAndAddPriorityColumn();
