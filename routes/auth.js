const express = require('express');
const bcrypt = require('bcryptjs');
const database = require('../config/database');

const router = express.Router();

// Initialize users table if it doesn't exist
async function initializeUsersTable() {
    try {
        await database.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
            CREATE TABLE Users (
                UserID INT IDENTITY(1,1) PRIMARY KEY,
                Username NVARCHAR(100) UNIQUE NOT NULL,
                PasswordHash NVARCHAR(255) NOT NULL,
                Email NVARCHAR(255),
                FirstName NVARCHAR(100),
                LastName NVARCHAR(100),
                Role NVARCHAR(50) DEFAULT 'user',
                IsActive BIT DEFAULT 1,
                CreatedDate DATETIME DEFAULT GETDATE(),
                LastLogin DATETIME
            )
        `);
        
        // Check if admin user exists
        const adminExists = await database.query(`SELECT COUNT(*) as count FROM Users WHERE Username = @username`, { username: 'admin' });
        
        if (adminExists.recordset[0].count === 0) {
            // Create default admin user
            const hashedPassword = await bcrypt.hash('admin123', 12);
            await database.query(`
                INSERT INTO Users (Username, PasswordHash, Email, FirstName, LastName, Role)
                VALUES (@username, @passwordHash, @email, @firstName, @lastName, @role)
            `, {
                username: 'admin',
                passwordHash: hashedPassword,
                email: 'admin@company.com',
                firstName: 'System',
                lastName: 'Administrator',
                role: 'admin'
            });
            
            console.log('Default admin user created with credentials: admin / admin123');
        }
    } catch (error) {
        console.error('Error initializing users table:', error);
    }
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.status(401).json({ error: 'Authentication required' });
    }
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        return res.status(403).json({ error: 'Admin access required' });
    }
}

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Get user from database
        const result = await database.query(
            'SELECT * FROM Users WHERE Username = @username AND IsActive = 1',
            { username }
        );
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const user = result.recordset[0];
        
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Update last login
        await database.query(
            'UPDATE Users SET LastLogin = GETDATE() WHERE UserID = @userId',
            { userId: user.UserID }
        );
        
        // Create session
        req.session.user = {
            id: user.UserID,
            username: user.Username,
            email: user.Email,
            firstName: user.FirstName,
            lastName: user.LastName,
            role: user.Role
        };
        
        res.json({
            success: true,
            user: req.session.user,
            dbConnected: true
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Signup endpoint
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, username, password } = req.body;
        
        if (!firstName || !lastName || !email || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }
        
        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        
        // Check if username already exists
        const usernameExists = await database.query(
            'SELECT COUNT(*) as count FROM Users WHERE Username = @username',
            { username }
        );
        
        if (usernameExists.recordset[0].count > 0) {
            return res.status(400).json({ error: 'Username is already taken' });
        }
        
        // Check if email already exists
        const emailExists = await database.query(
            'SELECT COUNT(*) as count FROM Users WHERE Email = @email',
            { email }
        );
        
        if (emailExists.recordset[0].count > 0) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create user with 'user' role by default
        const result = await database.query(`
            INSERT INTO Users (Username, PasswordHash, Email, FirstName, LastName, Role)
            VALUES (@username, @passwordHash, @email, @firstName, @lastName, @role);
            SELECT SCOPE_IDENTITY() as UserID;
        `, { 
            username, 
            passwordHash: hashedPassword, 
            email, 
            firstName, 
            lastName, 
            role: 'user' 
        });
        
        const newUserId = result.recordset[0].UserID;
        
        console.log(`New user registered: ${username} (${email})`);
        
        res.json({ 
            success: true, 
            message: 'Account created successfully',
            userId: newUserId
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Account creation failed' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    try {
        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).json({ error: 'Logout failed' });
            }
            
            res.clearCookie('connect.sid'); // Clear session cookie
            res.json({ success: true, message: 'Logged out successfully' });
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Get current user session
router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({
            user: req.session.user,
            dbConnected: true
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Change password
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
        
        // Get current user
        const result = await database.query(
            'SELECT PasswordHash FROM Users WHERE UserID = @userId',
            { userId: req.session.user.id }
        );
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.recordset[0];
        
        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.PasswordHash);
        
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);
        
        // Update password
        await database.query(
            'UPDATE Users SET PasswordHash = @passwordHash WHERE UserID = @userId',
            { passwordHash: hashedNewPassword, userId: req.session.user.id }
        );
        
        res.json({ success: true, message: 'Password changed successfully' });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Get all users (admin only)
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const result = await database.query(`
            SELECT UserID, Username, Email, FirstName, LastName, Role, IsActive, CreatedDate, LastLogin
            FROM Users
            ORDER BY Username
        `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user (admin only)
router.post('/users', requireAdmin, async (req, res) => {
    try {
        const { username, password, email, firstName, lastName, role = 'user' } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        
        // Check if username already exists
        const existingUser = await database.query(
            'SELECT COUNT(*) as count FROM Users WHERE Username = @username',
            { username }
        );
        
        if (existingUser.recordset[0].count > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create user
        const result = await database.query(`
            INSERT INTO Users (Username, PasswordHash, Email, FirstName, LastName, Role)
            VALUES (@username, @passwordHash, @email, @firstName, @lastName, @role)
        `, { username, passwordHash: hashedPassword, email, firstName, lastName, role });
        
        res.json({ 
            success: true, 
            message: 'User created successfully',
            userId: result.insertId
        });
        
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user (admin only)
router.put('/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { email, firstName, lastName, role, isActive } = req.body;
        
        await database.query(`
            UPDATE Users 
            SET Email = @email, FirstName = @firstName, LastName = @lastName, Role = @role, IsActive = @isActive
            WHERE UserID = @userId
        `, { email, firstName, lastName, role, isActive: isActive ? 1 : 0, userId });
        
        res.json({ success: true, message: 'User updated successfully' });
        
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Initialize the users table
initializeUsersTable();

// Export middleware functions
router.requireAuth = requireAuth;
router.requireAdmin = requireAdmin;

module.exports = router;
