#!/bin/bash
# persistence-setup.sh
# Ensures the Divorce Bins Evidence Console starts on boot and survives crashes.

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null
then
    echo "PM2 not found. Installing via npm..."
    npm install -g pm2
fi

# Start the server with pm2
echo "Starting Vault Backend with PM2..."
pm2 start server.js --name "vault-backend"

# Start the frontend with pm2 (optional, but good for persistence)
echo "Starting Vault Frontend with PM2..."
pm2 start "npm run dev -- --host" --name "vault-frontend"

# Configure pm2 to start on boot
echo "Configuring PM2 to start on boot..."
pm2 startup
pm2 save

echo "------------------------------------------------"
echo "Persistence Setup Complete."
echo "Use 'pm2 status' to monitor your processes."
echo "------------------------------------------------"
