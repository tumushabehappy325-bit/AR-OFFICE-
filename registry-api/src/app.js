const express = require('express');
const cors = require('cors');
const path = require('path');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Registry API is running', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/verify', require('./routes/verify'));

// Serve the web frontend (frontend/ folder) from the same server
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
