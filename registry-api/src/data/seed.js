// Sample accounts used by both the in-memory store and the PostgreSQL store.
const bcrypt = require('bcryptjs');

module.exports = [
  { id: 'u1', username: '2021/BSE/045', name: 'Akello Grace', role: 'student', program: 'BSc Software Engineering', graduationYear: 2025, passwordHash: bcrypt.hashSync('Student@123', 8) },
  { id: 'u2', username: '2021/BIT/012', name: 'Mugisha Brian', role: 'student', program: 'BSc Information Technology', graduationYear: 2025, passwordHash: bcrypt.hashSync('Student@123', 8) },
  { id: 'u3', username: 'officer@must.ac.ug', name: 'Namukasa Ruth', role: 'staff', program: null, graduationYear: null, passwordHash: bcrypt.hashSync('Staff@123', 8) },
  { id: 'u4', username: 'registrar@must.ac.ug', name: 'Dr. Tumwine Peter', role: 'admin', program: null, graduationYear: null, passwordHash: bcrypt.hashSync('Admin@123', 8) },
];
