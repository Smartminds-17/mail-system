#!/usr/bin/env node

/**
 * Setup script for Smart Email Automation System
 * Run this script to set up the database and initial configuration
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log(' Setting up Smart Email Automation System...\n');

// Check if .env file exists
if (!fs.existsSync('.env')) {
    console.log(' .env file not found!');
    console.log(' Please copy .env.example to .env and configure your settings:');
    console.log('   cp .env.example .env');
    console.log('   nano .env  (or your preferred editor)\n');
    process.exit(1);
}

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
};

console.log(' Setting up database...');

// Create database connection
const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
    if (err) {
        console.error(' Database connection failed:', err.message);
        console.log('\n💡 Make sure MySQL is running and your credentials are correct in .env file');
        process.exit(1);
    }

    console.log(' Connected to MySQL database');

    // Read and execute SQL file
    const sqlFile = path.join(__dirname, 'database.sql');

    if (!fs.existsSync(sqlFile)) {
        console.error(' database.sql file not found!');
        process.exit(1);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');

    connection.query(sql, (err, results) => {
        if (err) {
            console.error(' Error executing SQL:', err.message);
            process.exit(1);
        }

        console.log('Database tables created successfully');

        // Create uploads directory
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
            console.log('Uploads directory created');
        }

        connection.end((err) => {
            if (err) {
                console.error(' Error closing database connection:', err.message);
            } else {
                console.log('Database connection closed');
            }

            console.log('\n Setup completed successfully!');
            console.log('\nNext steps:');
            console.log('1. Install dependencies: npm install');
            console.log('2. Start the server: npm start');
            console.log('3. Visit http://localhost:3000 in your browser');
            console.log('\n💡 For development: npm run dev (with auto-reload)');
            console.log('\nDon\'t forget to configure your SMTP settings in .env file!');
        });
    });
});
