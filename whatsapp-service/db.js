require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.DB_HOST, // Replace with your DB host
    user: process.env.DB_USER,      // Replace with your DB user
    password: process.env.DB_PASSWORD, // Replace with your DB password
    database: process.env.DB_DATABASE, // Replace with your DB name
    connectionLimit: 10 // Optional for connection pooling
});

module.exports = db.promise(); // Export a promise-based interface
