#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🚀 Hood Shop Backend Setup');
console.log('========================\n');

// Check if .env file exists
if (!existsSync('.env')) {
  console.log('📝 Creating .env file from template...');
  
  const envExample = readFileSync('env.example', 'utf8');
  writeFileSync('.env', envExample);
  
  console.log('✅ .env file created!');
  console.log('⚠️  Please update the .env file with your actual configuration values.\n');
} else {
  console.log('✅ .env file already exists.\n');
}

// Check if node_modules exists
if (!existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully!\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Dependencies already installed.\n');
}

console.log('🎉 Setup completed!');
console.log('\nNext steps:');
console.log('1. Update your .env file with correct database credentials');
console.log('2. Make sure PostgreSQL is running and create the database');
console.log('3. Run: npm run dev');
console.log('\nFor detailed setup instructions, see README.md');
