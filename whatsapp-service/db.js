require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
    host: process.env.HOST, // Replace with your DB host
    user: process.env.USER,      // Replace with your DB user
    password: process.env.PASSWORD, // Replace with your DB password
    database: process.env.DATABASE, // Replace with your DB name
    connectionLimit: 10 // Optional for connection pooling
});

module.exports = db.promise(); // Export a promise-based interface
