// Production startup script with health checks
const { generateHealthReport } = require('./health-check');

async function startServer() {
    console.log('🚀 Starting Architecture App...');
    
    // Run health check first
    const isHealthy = await generateHealthReport();
    
    if (!isHealthy) {
        console.log('\n❌ Health check failed. Please fix the issues above before starting the server.');
        process.exit(1);
    }
    
    console.log('\n🟢 Health check passed! Starting server...\n');
    
    // Start the main server
    require('./server.js');
}

// Handle startup errors
process.on('uncaughtException', (error) => {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
});

startServer().catch((error) => {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
});
