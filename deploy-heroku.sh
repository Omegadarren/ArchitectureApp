#!/bin/bash

# Quick Heroku Deployment Script for Architecture App
# Run this script to deploy your app to Heroku

echo "🚀 Deploying Architecture App to Heroku..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   Download from: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Login to Heroku
echo "📝 Logging into Heroku..."
heroku login

# Get app name from user
read -p "Enter your app name (e.g., my-architecture-app): " APP_NAME

# Create Heroku app
echo "🏗️  Creating Heroku app: $APP_NAME"
heroku create $APP_NAME

# Set environment variables
echo "⚙️  Setting environment variables..."
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set SESSION_SECRET=$(openssl rand -hex 32) --app $APP_NAME
heroku config:set DB_TYPE=sqlite --app $APP_NAME

# Initialize git if not already done
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial deployment to Heroku"
fi

# Add Heroku remote
heroku git:remote -a $APP_NAME

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git push heroku main

# Open the app
echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://$APP_NAME.herokuapp.com"
echo "📱 You can now access this from your iPhone anywhere in the world!"

heroku open --app $APP_NAME
