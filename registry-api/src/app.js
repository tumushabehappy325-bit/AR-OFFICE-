const express = require('express');
const cors = require('cors');
const path = require('path');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Build the Express app separately from the listener so it can be reused by hosts and tools.
const app = express();
app.use(cors());
app.use(express.json());

// Simple endpoint for local checks and hosting-platform health checks.
app.get('/api/health', (req, res) => res.json({ success: true, message: 'Registry API is running', time: new Date().toISOString() }));

// Keep each API area in its own router.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/verify', require('./routes/verify'));

// Serve the web frontend (frontend/ folder) from the same server.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// These handlers must come last so unmatched routes and errors are handled consistently.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
