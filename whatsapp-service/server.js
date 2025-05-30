require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const multer = require('multer');
const csv = require('csv-parser');

const app = express();
const db = require('./db');
const upload = multer({ dest: 'uploads/' });
const striptags = require('striptags');

// Read SSL certificate files
const credentials = {
    key: fs.readFileSync('/home/ubuntu/ssl/privkey.pem'),
    cert: fs.readFileSync('/home/ubuntu/ssl/fullchain.pem'),
};

// Enable CORS for API requests (Express)
app.use(cors({
    origin: process.env.FRONTEND_URL, // Allow frontend at port 3001
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Whitelisted IPs
// async function getWhitelistedIPs() {
//     try {
//         const [rows] = await db.query('SELECT ip_address FROM ip_whitelists');
//         return rows.map(row => row.ip_address); // Extract IP addresses from the result
//     } catch (error) {
//         console.error('Error fetching whitelisted IPs:', error);
//         return [];
//     }
// }

// async function ipWhitelistMiddleware(req, res, next) {
//     const ipWhitelist = await getWhitelistedIPs(); // Dynamically fetch IPs from the database
//     const clientIp = req.ip.replace('::ffff:', ''); // Handle IPv4-mapped IPv6 addresses

//     if (ipWhitelist.includes(clientIp)) {
//         next(); // Allow access
//     } else {
//         console.warn(`[IP Blocked] Unauthorized access attempt from IP: ${clientIp}`);
//         res.status(403).json({ error: 'Access denied: Your IP is not whitelisted.' });
//     }
// }

// app.use(ipWhitelistMiddleware);

// Create HTTP server and integrate Socket.IO
// const server = http.createServer(app);
const server = https.createServer(credentials, app);

// Enable CORS for WebSocket (Socket.IO)
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // Allow frontend at port 3001
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
});

let existingSessions = new Set();
async function fetchPhoneSessions() {
    try {
        const [rows] = await db.query('SELECT * FROM whatsapp_services');
        return rows;
    } catch (error) {
        console.error('Error querying database:', error.message);
        return [];
    }
}

async function checkForNewSessions() {
    logWithTimestamp("Checking for new sessions...");
    const phoneSessions = await fetchPhoneSessions();
    const currentSessionNames = phoneSessions.map(session => session.name);

    // Handle new sessions
    phoneSessions.forEach((session) => {
        if (!existingSessions.has(session.name)) {
            // Initialize the session if it's new
            logWithTimestamp(`Initializing new session: ${session.name}`);
            initializeSession(session);
            existingSessions.add(session.name);
        }
    });

    // Handle deleted sessions
    const deletedSessions = [...existingSessions].filter(sessionName => !currentSessionNames.includes(sessionName));
    deletedSessions.forEach(async (sessionName) => {
        logWithTimestamp(`Cleaning up deleted session: ${sessionName}`);

        // Find and stop the client
        const clientIndex = clients.findIndex(clientObj => clientObj.name === sessionName);
        if (clientIndex !== -1) {
            const client = clients[clientIndex].client;
            try {
                await client.destroy(); // Gracefully stop the client
                logWithTimestamp(`[${sessionName}] Client destroyed.`);
            } catch (error) {
                errorWithTimestamp(`[${sessionName}] Error while destroying client: ${error.message}`);
            }
            clients.splice(clientIndex, 1); // Remove from clients array
        }

        // Remove session data from disk
        const sessionPath = path.join(__dirname, `.wwebjs_auth/session-${sessionName}`);
        await retryDelete(sessionPath);

        // Remove from existing sessions
        existingSessions.delete(sessionName);
    });
}

const logWithTimestamp = (msg) => {
    const logMessage = `\n[${new Date().toISOString()}] ${msg}\n`;
    console.log(logMessage);
};
const errorWithTimestamp = (msg) => {
    const logDir = path.join(__dirname, 'logs');
    const logFile = path.join(logDir, 'error.log');

    // Create the logs folder if it doesn't exist
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    const logMessage = `\n[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.error(logMessage);
};
const warnWithTimestamp = (msg) => {
    const logMessage = `\n[${new Date().toISOString()}] ${msg}\n`;
    console.warn(logMessage);
};

// Store WhatsApp clients
const clients = [];
let currentClientIndex = 0;

// Utility function: Retry deleting a file/directory
async function retryDelete(filePath, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            if (fs.existsSync(filePath)) {
                fs.removeSync(filePath);
                logWithTimestamp(`Successfully deleted: ${filePath}`);
            }
            break; // Exit loop if successful
        } catch (error) {
            warnWithTimestamp(`Retry ${i + 1}: Failed to delete ${filePath}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Initialize clients
function initializeSession(session) {
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: session.name // Unique ID for each session
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Fix permission issues
        }
    });

    // Generate QR code if session is invalid or new
    client.on('qr', (qr) => {
        logWithTimestamp(`[${session.name}] Scan this QR code for ${session.number} :`);
        qrcode.generate(qr, { small: true });
        io.emit('qr', { sessionName: session.name, qr });
    });

    // Client ready
    client.on('ready', () => {
        logWithTimestamp(`[${session.name}] Client for ${session.number} is ready!`);
        io.emit('ready', { sessionName: session.name });
    });

    // Handle client disconnections
    client.on('disconnected', async (reason) => {
        warnWithTimestamp(`[${session.name}] Disconnected due to: ${reason}`);
        io.emit('disconnected', { sessionName: session.name, reason });

        try {
            logWithTimestamp(`[${session.name}] Closing client to release resources...`);
            await client.destroy(); // Gracefully stop Puppeteer and release files

            const sessionPath = path.join(__dirname, `.wwebjs_auth/session-${session.name}`);
            logWithTimestamp(`[${session.name}] Clearing session data...`);

            // Delay to ensure all file handles are released
            await new Promise((resolve) => setTimeout(resolve, 3000));

            await retryDelete(sessionPath); // Retry clearing session folder

            logWithTimestamp(`[${session.name}] Session data cleared successfully.`);
            logWithTimestamp(`[${session.name}] Restarting to rescan QR.`);
            initializeSession(session); // Reinitialize the client session
        } catch (error) {
            errorWithTimestamp(`[${session.name}] Failed to clear session data: ${error.message}`);
        }
    });

    // Error handling for unexpected issues
    client.on('auth_failure', (msg) => {
        errorWithTimestamp(`[${session.name}] Authentication failure: ${msg}`);
    });

    client.on('change_state', (state) => {
        logWithTimestamp(`[${session.name}] Client state: ${state}`);
    });

    client.on('error', (err) => {
        errorWithTimestamp(`[${session.name}] Error: ${err.message}`);
    });

    clients.push({ name: session.name, client });

    client.initialize().catch((err) => {
        errorWithTimestamp(`[${session.name}] Failed to initialize client: ${err.message}`);
    });
}

// Initialize all sessions
fetchPhoneSessions().then((phoneSessions) => {
    // console.log(phoneSessions);
    phoneSessions.forEach(initializeSession);
});

// TESTING PURPPOSE
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

// API endpoint to send messages
app.post('/send-message', async (req, res) => {
    const { chatId, message, imageUrl, base64Image, filePath } = req.body;

    if (!chatId || !message) {
        return res.status(400).json({ error: 'chatId and message are required.' });
    }

    const result = await sendMessageWithClient(chatId, message, { imageUrl, base64Image, filePath });

    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
});

const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const chatIds = [];

        fs.createReadStream(filePath)
            .pipe(csv({ headers: false }))
            .on('data', (row) => {
                const chatId = Object.values(row)[0]?.toString().trim();
                if (chatId) chatIds.push(chatId);
            })
            .on('end', () => {
                resolve(chatIds);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

app.post('/send-bulk-message', upload.single('csvFile'), async (req, res) => {
    const { message, imageUrl, base64Image, filePath } = req.body;
    const csvFilePath = req.file?.path;

    if (!csvFilePath || !message) {
        return res.status(400).json({ error: 'CSV file and message are required.' });
    }

    try {
        const chatIds = await parseCSV(csvFilePath);
        const results = [];

        for (const chatId of chatIds) {
            const result = await sendMessageWithClient(chatId, message, { imageUrl, base64Image, filePath });
            results.push({ chatId, ...result });
        }

        fs.unlinkSync(csvFilePath); // clean up
        res.json({ results });

    } catch (err) {
        console.error('Error during CSV processing or messaging:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

async function sendMessageWithClient(chatId, message, mediaOptions = {}) {
    chatId = formatPhoneNumber(chatId);
    // message = striptags(message || '');
    message = htmlToWhatsappText(message || '');
    let attempts = 0;
    const totalClients = clients.length;
    const startIndex = currentClientIndex;

    while (attempts < totalClients) {
        const clientIndex = (startIndex + attempts) % totalClients;
        const clientObj = clients[clientIndex];
        const client = clientObj.client;

        if (client.info && isClientReady(client)) {
            try {
                let media = null;

                if (mediaOptions.imageUrl) {
                    media = await MessageMedia.fromUrl(mediaOptions.imageUrl);
                } else if (mediaOptions.base64Image) {
                    const mimeType = mediaOptions.base64Image.substring(
                        mediaOptions.base64Image.indexOf(':') + 1,
                        mediaOptions.base64Image.indexOf(';')
                    );
                    media = new MessageMedia(mimeType, mediaOptions.base64Image.split(',')[1]);
                } else if (mediaOptions.filePath) {
                    media = MessageMedia.fromFilePath(mediaOptions.filePath);
                }

                if (media) {
                    await client.sendMessage(chatId, media, { caption: message || '' });
                    logWithTimestamp(`Image sent from session ${clientObj.name} to ${chatId}`);
                } else {
                    await client.sendMessage(chatId, message);
                    logWithTimestamp(`Message sent from session ${clientObj.name} to ${chatId}`);
                }

                currentClientIndex = (clientIndex + 1) % totalClients; // update only after successful send
                return { success: true, from: clientObj.name };
            } catch (err) {
                errorWithTimestamp(`[${clientObj.name}] Failed to send message: ${err.message}`);
            }
        } else {
            warnWithTimestamp(`[${clientObj.name}] Session not connected. Skipping...`);
        }

        attempts++;
    }

    return { success: false, error: 'No connected sessions available to send the message.' };
}

function htmlToWhatsappText(html) {
    return html
        .replace(/&nbsp;/gi, ' ')              // replace &nbsp; with regular space
        .replace(/<p>/gi, '')                  // remove opening <p>
        .replace(/<\/p>/gi, '\n')              // replace closing </p> with newline
        .replace(/<br\s*\/?>/gi, '\n')         // convert <br> to newline
        .replace(/<b>|<strong>/gi, '*')        // convert bold
        .replace(/<\/b>|<\/strong>/gi, '*')
        .replace(/<i>|<em>/gi, '_')            // convert italic
        .replace(/<\/i>|<\/em>/gi, '_')
        .replace(/<u>/gi, '')                  // remove underline (unsupported)
        .replace(/<\/u>/gi, '')
        .replace(/<\/?[^>]+(>|$)/g, '')        // remove all other tags
        .trim();                               // clean up
}


// async function sendMessageWithClient(chatId, message, mediaOptions = {}) {
//     chatId = formatPhoneNumber(chatId);
//     message = striptags(message || '');
//     let attempts = 0;

//     while (attempts < clients.length) {
//         const clientObj = clients[currentClientIndex];
//         const client = clientObj.client;

//         if (client.info && isClientReady(client)) {
//             try {
//                 let media = null;

//                 if (mediaOptions.imageUrl) {
//                     media = await MessageMedia.fromUrl(mediaOptions.imageUrl);
//                 } else if (mediaOptions.base64Image) {
//                     const mimeType = mediaOptions.base64Image.substring(
//                         mediaOptions.base64Image.indexOf(':') + 1,
//                         mediaOptions.base64Image.indexOf(';')
//                     );
//                     media = new MessageMedia(mimeType, mediaOptions.base64Image.split(',')[1]);
//                 } else if (mediaOptions.filePath) {
//                     media = MessageMedia.fromFilePath(mediaOptions.filePath);
//                 }

//                 if (media) {
//                     await client.sendMessage(chatId, media, { caption: message || '' });
//                     logWithTimestamp(`Image sent from session ${clientObj.name} to ${chatId}`);
//                 } else {
//                     await client.sendMessage(chatId, message);
//                     logWithTimestamp(`Message sent from session ${clientObj.name} to ${chatId}`);
//                 }

//                 return { success: true, from: clientObj.name };
//             } catch (err) {
//                 errorWithTimestamp(`[${clientObj.name}] Failed to send message: ${err.message}`);
//             }
//         } else {
//             warnWithTimestamp(`[${clientObj.name}] Session not connected. Skipping...`);
//         }

//         currentClientIndex = (currentClientIndex + 1) % clients.length;
//         attempts++;
//     }

//     return { success: false, error: 'No connected sessions available to send the message.' };
// }


// Utility function to check if a client is ready
function isClientReady(client) {
    return client.info && client.info.wid;
}

// Utility function to format phone number to chatId
function formatPhoneNumber(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    return cleanNumber.endsWith('@c.us') ? cleanNumber : `${cleanNumber}@c.us`;
}

// Handle all uncaught exceptions globally
process.on('uncaughtException', (err) => {
    errorWithTimestamp("Uncaught Exception:", err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    errorWithTimestamp('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Check for new sessions every 10 seconds
setInterval(checkForNewSessions, 10000); // Check every 10 seconds

// Start Express server with Socket.IO
const PORT = 3000;
server.listen(PORT, () => {
    logWithTimestamp(`Server is running on http://localhost:${PORT}`);
});
