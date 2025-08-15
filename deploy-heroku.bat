@echo off
REM Quick Heroku Deployment Script for Architecture App (Windows)
REM Run this script to deploy your app to Heroku

echo 🚀 Deploying Architecture App to Heroku...

REM Check if Heroku CLI is installed
heroku --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Heroku CLI not found. Please install it first:
    echo    Download from: https://devcenter.heroku.com/articles/heroku-cli
    pause
    exit /b 1
)

REM Login to Heroku
echo 📝 Logging into Heroku...
heroku login

REM Get app name from user
set /p APP_NAME=Enter your app name (e.g., my-architecture-app): 

REM Create Heroku app
echo 🏗️  Creating Heroku app: %APP_NAME%
heroku create %APP_NAME%

REM Set environment variables
echo ⚙️  Setting environment variables...
heroku config:set NODE_ENV=production --app %APP_NAME%
heroku config:set SESSION_SECRET=your-super-secure-session-secret-replace-this --app %APP_NAME%
heroku config:set DB_TYPE=sqlite --app %APP_NAME%

REM Initialize git if not already done
if not exist ".git" (
    echo 📦 Initializing Git repository...
    git init
    git add .
    git commit -m "Initial deployment to Heroku"
)

REM Add Heroku remote
heroku git:remote -a %APP_NAME%

REM Deploy to Heroku
echo 🚀 Deploying to Heroku...
git push heroku main

REM Open the app
echo ✅ Deployment complete!
echo 🌐 Your app is available at: https://%APP_NAME%.herokuapp.com
echo 📱 You can now access this from your iPhone anywhere in the world!

heroku open --app %APP_NAME%
pause
