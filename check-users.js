const db = require('./config/database');

(async () => {
  try {
    console.log('Checking for Users table...');
    const result = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Users'");
    console.log('Users table exists:', result.length > 0);
    
    if (result.length > 0) {
      const users = await db.query('SELECT Username FROM Users');
      console.log('Existing users:', users.map(u => u.Username));
    } else {
      console.log('Users table does not exist - need to create it');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
