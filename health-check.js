#!/usr/bin/env node

/**
 * Development Setup and Health Check Script
 * This script helps identify and fix common issues with the Architecture App
 */

const fs = require('fs');
const path = require('path');
const database = require('./config/database');
const { testEmailConfig } = require('./config/email');
require('dotenv').config();

console.log('🚀 Architecture App - Development Setup & Health Check');
console.log('=' .repeat(60));

async function checkEnvironment() {
    console.log('\n📋 Environment Check:');
    
    // Check Node.js version
    console.log(`   Node.js version: ${process.version}`);
    
    // Check if all required environment variables are set
    const requiredEnvVars = [
        'DB_SERVER',
        'DB_DATABASE', 
        'DB_USER',
        'DB_PASSWORD',
        'EMAIL_USER'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log('   ❌ Missing environment variables:', missingVars.join(', '));
        console.log('   💡 Please check your .env file');
        return false;
    } else {
        console.log('   ✅ All required environment variables are set');
        return true;
    }
}

async function checkDatabase() {
    console.log('\n🗄️  Database Check:');
    
    try {
        await database.connect();
        console.log('   ✅ Database connection successful');
        
        // Check if main tables exist
        const tables = await database.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);
        
        const tableNames = tables.recordset.map(t => t.TABLE_NAME);
        const requiredTables = ['Customers', 'Projects', 'Estimates', 'Invoices', 'Contracts'];
        const missingTables = requiredTables.filter(table => !tableNames.includes(table));
        
        if (missingTables.length > 0) {
            console.log('   ❌ Missing tables:', missingTables.join(', '));
            return false;
        } else {
            console.log('   ✅ All required tables exist');
            console.log(`   📊 Found ${tableNames.length} tables:`, tableNames.join(', '));
            return true;
        }
        
    } catch (error) {
        console.log('   ❌ Database connection failed:', error.message);
        return false;
    }
}

async function checkEmail() {
    console.log('\n📧 Email Configuration Check:');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.log('   ⚠️  Email not configured (EMAIL_USER or EMAIL_APP_PASSWORD missing)');
        console.log('   💡 Email features will be disabled until configured');
        return false;
    }
    
    try {
        const result = await testEmailConfig();
        if (result.success) {
            console.log('   ✅ Email configuration is valid');
            return true;
        } else {
            console.log('   ❌ Email configuration failed:', result.error);
            console.log('   💡 Common fixes:');
            console.log('      - Generate a new Gmail App Password');
            console.log('      - Ensure 2-Factor Authentication is enabled');
            console.log('      - Check username/password are correct');
            return false;
        }
    } catch (error) {
        console.log('   ❌ Email test error:', error.message);
        return false;
    }
}

async function checkDependencies() {
    console.log('\n📦 Dependencies Check:');
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        const deps = Object.keys(packageJson.dependencies || {});
        console.log(`   ✅ Found ${deps.length} dependencies`);
        
        // Check if node_modules exists
        if (fs.existsSync('./node_modules')) {
            console.log('   ✅ node_modules directory exists');
            return true;
        } else {
            console.log('   ❌ node_modules directory missing');
            console.log('   💡 Run: npm install');
            return false;
        }
    } catch (error) {
        console.log('   ❌ Cannot read package.json:', error.message);
        return false;
    }
}

async function checkFiles() {
    console.log('\n📁 File Structure Check:');
    
    const requiredFiles = [
        'server.js',
        'package.json',
        '.env',
        'config/database.js',
        'config/email.js',
        'public/index.html',
        'public/js/app.js'
    ];
    
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length > 0) {
        console.log('   ❌ Missing files:', missingFiles.join(', '));
        return false;
    } else {
        console.log('   ✅ All required files exist');
        return true;
    }
}

async function generateHealthReport() {
    console.log('\n🏥 Generating Health Report...');
    
    const envOk = await checkEnvironment();
    const filesOk = await checkFiles();
    const depsOk = await checkDependencies();
    const dbOk = await checkDatabase();
    const emailOk = await checkEmail();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 HEALTH REPORT SUMMARY:');
    console.log('='.repeat(60));
    
    console.log(`Environment Variables: ${envOk ? '✅' : '❌'}`);
    console.log(`File Structure:        ${filesOk ? '✅' : '❌'}`);
    console.log(`Dependencies:          ${depsOk ? '✅' : '❌'}`);
    console.log(`Database:              ${dbOk ? '✅' : '❌'}`);
    console.log(`Email Configuration:   ${emailOk ? '✅' : '⚠️ '}`);
    
    const overallHealth = envOk && filesOk && depsOk && dbOk;
    console.log(`\nOverall Health: ${overallHealth ? '🟢 HEALTHY' : '🔴 NEEDS ATTENTION'}`);
    
    if (!overallHealth) {
        console.log('\n🛠️  Next Steps:');
        if (!envOk) console.log('   1. Check .env file configuration');
        if (!filesOk) console.log('   2. Ensure all required files exist');
        if (!depsOk) console.log('   3. Run: npm install');
        if (!dbOk) console.log('   4. Check database connection settings');
    } else {
        console.log('\n🎉 Your app is healthy and ready to run!');
        console.log('   💡 To start the server: npm start or node server.js');
    }
    
    if (!emailOk) {
        console.log('\n📧 Email Setup Instructions:');
        console.log('   1. Go to: https://myaccount.google.com/apppasswords');
        console.log('   2. Generate a new App Password for "Mail"');
        console.log('   3. Update EMAIL_APP_PASSWORD in .env file');
        console.log('   4. Restart the server');
    }
    
    return overallHealth;
}

async function main() {
    try {
        const isHealthy = await generateHealthReport();
        process.exit(isHealthy ? 0 : 1);
    } catch (error) {
        console.error('\n❌ Health check failed:', error.message);
        process.exit(1);
    } finally {
        await database.close();
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { 
    checkEnvironment, 
    checkDatabase, 
    checkEmail, 
    checkDependencies, 
    checkFiles,
    generateHealthReport 
};
