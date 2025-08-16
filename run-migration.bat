@echo off
echo Setting up Azure to PostgreSQL migration environment...
echo.

echo Please enter your Azure SQL Database details:
echo.

set /p AZURE_SERVER=Azure SQL Server (e.g., myserver.database.windows.net): 
set /p AZURE_DATABASE=Database Name (e.g., ArchitectureApp): 
set /p AZURE_USERNAME=Username: 
set /p AZURE_PASSWORD=Password: 

echo.
echo Please enter your Railway PostgreSQL DATABASE_URL:
set /p DATABASE_URL=DATABASE_URL (from Railway PostgreSQL service): 

echo.
echo Setting environment variables...

set AZURE_DB_SERVER=%AZURE_SERVER%
set AZURE_DB_DATABASE=%AZURE_DATABASE%
set AZURE_DB_USERNAME=%AZURE_USERNAME%
set AZURE_DB_PASSWORD=%AZURE_PASSWORD%

echo.
echo Environment variables set! Now running migration...
echo.

node migrate-azure-to-postgres.js

echo.
echo Migration completed! Check the output above for results.
pause
