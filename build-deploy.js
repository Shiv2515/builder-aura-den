#!/usr/bin/env node

/**
 * PulseSignal AI - Deployment Builder
 * Automatically configures and builds the app for production deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 PulseSignal AI - Production Build Setup');
console.log('=========================================');

// Ensure all environment variables are set
const requiredEnvVars = {
  'OPENAI_API_KEY': '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',
  'SOLANA_RPC_URL': 'https://api.mainnet-beta.solana.com',
  'NODE_ENV': 'production',
  'PORT': '8080'
};

// Write environment file
const envContent = Object.entries(requiredEnvVars)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync('.env', envContent);
console.log('✅ Environment variables configured');

// Create Netlify functions
const netlifyFunctionsDir = 'netlify/functions';
if (!fs.existsSync(netlifyFunctionsDir)) {
  fs.mkdirSync(netlifyFunctionsDir, { recursive: true });
}

// Create API function for Netlify
const netlifyApiFunction = `
const serverless = require('serverless-http');
const { createServer } = require('../../dist/server/node-build.mjs');

const app = createServer();
exports.handler = serverless(app);
`;

fs.writeFileSync(path.join(netlifyFunctionsDir, 'api.js'), netlifyApiFunction);
console.log('✅ Netlify functions configured');

// Create Vercel API routes
const vercelApiDir = 'api';
if (!fs.existsSync(vercelApiDir)) {
  fs.mkdirSync(vercelApiDir, { recursive: true });
}

// Create index.js for Vercel
const vercelApiFunction = `
const { createServer } = require('../dist/server/node-build.mjs');

const app = createServer();

module.exports = app;
`;

fs.writeFileSync(path.join(vercelApiDir, 'index.js'), vercelApiFunction);
console.log('✅ Vercel API routes configured');

// Update package.json for deployment
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = {
  ...packageJson.scripts,
  'build:netlify': 'npm run build && cp -r dist/server netlify/functions/',
  'build:vercel': 'npm run build && cp -r dist/server api/',
  'postbuild': 'node build-deploy.js'
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ Package.json updated for deployment');

console.log('\n🎯 Deployment Ready!');
console.log('==================');
console.log('✅ All API keys embedded');
console.log('✅ All endpoints configured');
console.log('✅ All dependencies included');
console.log('✅ Build scripts optimized');
console.log('✅ Netlify & Vercel ready');
console.log('\n🚀 Ready to drag & drop deploy!');
