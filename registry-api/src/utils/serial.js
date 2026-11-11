const crypto = require('crypto');

// Serial format: MUST-TR-<YEAR>-<6 uppercase letters or digits>, e.g. MUST-TR-2026-A7K93Q
const SERIAL_REGEX = /^MUST-TR-\d{4}-[A-Z0-9]{6}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

function generateSerial() {
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) suffix += ALPHABET[bytes[i] % ALPHABET.length];
  return `MUST-TR-${new Date().getFullYear()}-${suffix}`;
}

module.exports = { generateSerial, SERIAL_REGEX };
