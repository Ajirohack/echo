#!/bin/bash

# Navigate to the correct directory
cd "$(dirname "$0")"

# Make sure dependencies are installed
npm install electron-log electron-updater

# Start the Electron app
./node_modules/.bin/electron .
