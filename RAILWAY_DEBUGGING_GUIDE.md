# Railway Debugging Guide

## How to Check Railway Dashboard Logs

### Step 1: Access Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Sign in to your account
3. Navigate to your "ArchitectureApp" project

### Step 2: Check Deployment Logs
1. Click on your project (ArchitectureApp)
2. Click on the service/deployment tab
3. Look for the "Deployments" section
4. Click on the most recent deployment

### Step 3: What to Look For

#### Build Logs
- Look for any errors during the build process
- Check if dependencies are installing correctly
- Verify that the Node.js version is compatible

#### Runtime Logs
- Look for startup messages from our server
- Check if the server is actually starting
- Look for any crash logs or error messages

#### Common Issues to Check:

1. **Port Binding Errors**
   ```
   Error: listen EADDRINUSE :::3000
   ```

2. **Memory Issues**
   ```
   FATAL ERROR: Ineffective mark-compacts near heap limit
   ```

3. **Module Loading Errors**
   ```
   Cannot find module 'express'
   ```

4. **Startup Crashes**
   ```
   Process exited with code 1
   ```

### Step 4: Environment Variables
1. In the Railway dashboard, go to "Variables" tab
2. Verify these environment variables are set:
   - `PORT` (should be auto-set by Railway)
   - `DATABASE_URL` (PostgreSQL connection string)
   - `NODE_ENV` (optional, but recommended)

### Step 5: Service Settings
Check these settings in Railway:
1. **Health Check Path**: Should be `/health` or `/`
2. **Restart Policy**: Should be set appropriately
3. **Memory/CPU Limits**: Check if we're hitting limits

## Expected Log Output

If everything is working, you should see logs like:
```
Starting bare HTTP server...
PORT: 3000
Node version: v18.x.x
=== BARE HTTP SERVER STARTED ===
Server running on port 3000
PID: 1
=== READY ===
```

## If Logs Show Errors

### Memory Errors
- Increase memory limit in Railway settings
- Or add memory optimization flags

### Port Errors
- Railway should auto-set PORT environment variable
- Verify our code uses `process.env.PORT`

### Module Errors
- Check if package.json dependencies are correct
- Verify build process completed successfully

### Connection Errors
- Check if DATABASE_URL is correctly formatted
- Verify PostgreSQL service is running

## Next Steps Based on Logs

1. **If logs show successful startup but still 502**:
   - Health check configuration issue
   - Load balancer routing problem
   - Contact Railway support

2. **If logs show crashes/errors**:
   - Fix the specific error
   - Deploy updated code
   - Monitor logs again

3. **If no logs appear**:
   - Build process might be failing
   - Check build logs specifically
   - Verify GitHub integration

## Railway Support Information

If logs don't reveal the issue:
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Railway Support: support@railway.app
- Include project ID and deployment ID when contacting support

## Quick Test Commands

After checking logs, you can test locally:
```bash
# Test locally with Railway environment
npm start

# Test with specific port
PORT=3000 npm start

# Test bare HTTP server
node bare-http.js
```
