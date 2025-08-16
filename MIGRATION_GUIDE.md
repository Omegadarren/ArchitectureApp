# Azure to PostgreSQL Migration Environment Setup

## Required Environment Variables

Before running the migration, you need to set up environment variables for both Azure SQL and Railway PostgreSQL.

### 1. Azure SQL Variables (for export)

Create a `.env.azure` file with your Azure SQL connection details:

```bash
# Azure SQL Database (for data export)
AZURE_DB_SERVER=your-azure-server.database.windows.net
AZURE_DB_DATABASE=ArchitectureApp
AZURE_DB_USERNAME=your-azure-username
AZURE_DB_PASSWORD=your-azure-password
```

### 2. Railway PostgreSQL Variables (for import)

Get these from your Railway project:

```bash
# Railway PostgreSQL Database (for data import)
DATABASE_URL=postgresql://postgres:password@host:port/database
DB_TYPE=postgresql
```

## Migration Steps

### Step 1: Set Up PostgreSQL on Railway

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Select your project**: ArchitectureApp
3. **Add PostgreSQL**:
   - Click "Add Service" → "Database" → "PostgreSQL"
   - Railway will provision a PostgreSQL database
4. **Get connection string**:
   - Click on the PostgreSQL service
   - Go to "Variables" tab
   - Copy the `DATABASE_URL`

### Step 2: Update Your App Service Variables

In your main ArchitectureApp service on Railway, add these variables:

```bash
DATABASE_URL=postgresql://postgres:...    # Copy from PostgreSQL service
DB_TYPE=postgresql
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secure-secret-key
```

### Step 3: Install Dependencies

```bash
npm install pg
```

### Step 4: Run Migration

```bash
# Load Azure environment variables
# On Windows:
set AZURE_DB_SERVER=your-server.database.windows.net
set AZURE_DB_DATABASE=ArchitectureApp
set AZURE_DB_USERNAME=your-username
set AZURE_DB_PASSWORD=your-password
set DATABASE_URL=postgresql://postgres:...

# Run migration
node migrate-azure-to-postgres.js
```

### Step 5: Deploy Updated Config

```bash
# Replace database config with PostgreSQL version
cp config/database-new.js config/database.js

# Deploy to Railway
git add .
git commit -m "Add PostgreSQL support and migration"
git push origin main
```

## What the Migration Does

1. **Exports all data** from your Azure SQL database
2. **Creates proper table structure** in PostgreSQL with:
   - Correct data types
   - Primary keys and foreign keys
   - Proper column naming (snake_case)
3. **Imports all data** maintaining relationships
4. **Creates admin user** automatically
5. **Saves backup files** for safety

## Benefits of PostgreSQL on Railway

✅ **Persistent storage** - Data survives deployments  
✅ **Automatic backups** - Railway handles this  
✅ **Better performance** - Optimized for web applications  
✅ **Scalable** - Can grow with your business  
✅ **Cost effective** - No Azure SQL licensing costs  

## Troubleshooting

### Common Issues:

1. **Connection timeouts**: Check firewall rules
2. **Authentication failed**: Verify credentials
3. **Table doesn't exist**: Check table names and schema
4. **Import errors**: Check data types and constraints

### Getting Help:

- Check the console output for detailed error messages
- Verify all environment variables are set correctly
- Test connections individually before running full migration
