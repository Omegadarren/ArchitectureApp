const bcrypt = require('bcryptjs');
const db = require('./config/database');

(async () => {
  try {
    console.log('Creating admin user...');
    
    // Hash the password 'admin'
    const hashedPassword = await bcrypt.hash('admin', 10);
    console.log('Password hashed successfully');
    
    // Connect to database
    await db.connect();
    console.log('Connected to database');
    
    // Delete existing admin user if exists
    await db.query('DELETE FROM Users WHERE Username = ?', ['admin']);
    console.log('Removed existing admin user');
    
    // Create new admin user
    await db.query(`INSERT INTO Users (Username, Password, FirstName, LastName, Email) VALUES (?, ?, ?, ?, ?)`, 
      ['admin', hashedPassword, 'Admin', 'User', 'admin@company.com']);
    
    console.log('Admin user created successfully!');
    console.log('Login credentials: admin / admin');
    
    // Verify the user was created
    const result = await db.query('SELECT Username, FirstName, LastName FROM Users WHERE Username = ?', ['admin']);
    console.log('User verification:', result.recordset);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
})();
