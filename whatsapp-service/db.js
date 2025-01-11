const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost', // Replace with your DB host
    user: 'root',      // Replace with your DB user
    password: '', // Replace with your DB password
    database: 'whatsapp', // Replace with your DB name
    connectionLimit: 10 // Optional for connection pooling
});

module.exports = db.promise(); // Export a promise-based interface
