#!/bin/bash
# Railway startup script
echo "🚀 Starting Architecture App on Railway..."
echo "Memory limit: 512MB"
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"

# Set memory optimization
export NODE_OPTIONS="--max-old-space-size=512"

# Start the server
exec node server.js
