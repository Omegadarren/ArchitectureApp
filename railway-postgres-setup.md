# Railway PostgreSQL Setup Guide

## Step 1: Add PostgreSQL to Railway

1. **Go to your Railway project dashboard**:
   - Visit https://railway.app/dashboard
   - Select your ArchitectureApp project

2. **Add PostgreSQL service**:
   - Click "Add Service" or "+"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically provision a PostgreSQL database

3. **Get connection details**:
   - Click on the PostgreSQL service
   - Go to "Variables" tab
   - Copy these environment variables:
     - `DATABASE_URL` (full connection string)
     - `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

4. **Add to your main service**:
   - Go to your main ArchitectureApp service
   - Click "Variables" tab
   - Add these variables:
     ```
     DATABASE_URL=postgresql://user:password@host:port/database
     DB_TYPE=postgresql
     ```

## Step 2: Update Environment Variables

Your Railway service will need these variables:
- `DATABASE_URL` - Full PostgreSQL connection string
- `DB_TYPE=postgresql`
- `NODE_ENV=production`
- `PORT=3000`
- `SESSION_SECRET=your-secure-secret`

## Step 3: Run Migration

After setup, run the migration script to copy your Azure data to PostgreSQL.

## Benefits of PostgreSQL on Railway

✅ **Persistent storage** - Data survives deployments
✅ **Automatic backups** - Railway handles backups
✅ **Scalable** - Can handle production workloads
✅ **SQL compatible** - Easy migration from Azure SQL
✅ **Railway integration** - Seamless setup
