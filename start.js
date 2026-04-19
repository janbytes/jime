const { execSync } = require('child_process');
const fs = require('fs');

if (!fs.existsSync('node_modules')) {
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
}
execSync('node server.js', { stdio: 'inherit' });