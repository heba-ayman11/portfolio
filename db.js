const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure uploads/cv directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'cv');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'portfolio.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for better concurrency and performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Helper to hash passwords securely using PBKDF2
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, salt, storedHash) {
  const hash = hashPassword(password, salt);
  const hashBuffer = Buffer.from(hash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (hashBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}

// Create schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      review TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      role TEXT DEFAULT 'Client / Collaborator',
      is_approved INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cv_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT DEFAULT 'application/pdf',
      is_active INTEGER DEFAULT 1,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );
  `);

  // Seed default admin if none exists
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get().count;
  if (adminCount === 0) {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'Admin@Heba2026!';
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(defaultPassword, salt);

    db.prepare('INSERT INTO admin_users (username, password_hash, salt) VALUES (?, ?, ?)')
      .run(defaultUsername, passwordHash, salt);
    console.log(`[DB] Default administrator created: "${defaultUsername}"`);
  }

  // Seed initial CV record if none exists
  const cvCount = db.prepare('SELECT COUNT(*) as count FROM cv_files WHERE is_active = 1').get().count;
  if (cvCount === 0) {
    const initialCvPath = path.join(uploadsDir, 'CV_Heba Allah Ayman.pdf');
    let fileSize = 324014;
    if (fs.existsSync(initialCvPath)) {
      fileSize = fs.statSync(initialCvPath).size;
    }
    db.prepare(`
      INSERT INTO cv_files (original_name, filename, file_path, file_size, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run('CV_Heba Allah Ayman.pdf', 'CV_Heba Allah Ayman.pdf', 'uploads/cv/CV_Heba Allah Ayman.pdf', fileSize);
    console.log(`[DB] Initial CV registered: "CV_Heba Allah Ayman.pdf" (${fileSize} bytes)`);
  }

  // Seed initial endorsements/reviews if empty
  const reviewCount = db.prepare('SELECT COUNT(*) as count FROM reviews').get().count;
  if (reviewCount === 0) {
    const seedReviews = [
      {
        name: 'Sarah Nabil',
        role: 'Senior Front-End Engineer',
        rating: 5,
        review: 'Heba has a sharp eye for clean UI design and translates technical requirements into seamless frontend experiences. Her passion for .NET backend development makes her a very versatile developer.'
      },
      {
        name: 'Ahmed Mahmoud',
        role: 'Team Lead / .NET Architect',
        rating: 5,
        review: 'Working with Heba during our project team sessions was fantastic. Her grasp of C# and SQL Server structure alongside her problem-solving speed helped our team deliver on time.'
      },
      {
        name: 'Mona El-Sayed',
        role: 'Technical Instructor / Mentor',
        rating: 5,
        review: 'Heba demonstrated exceptional dedication during our training program. Her ability to quickly master new web frameworks and create polished, responsive applications is admirable.'
      }
    ];

    const insertReview = db.prepare(`
      INSERT INTO reviews (name, role, rating, review, is_approved)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (const r of seedReviews) {
      insertReview.run(r.name, r.role, r.rating, r.review);
    }
    console.log('[DB] Initial seed reviews populated');
  }
}

initSchema();

// Database Query Methods
const dbQueries = {
  // Reviews
  getApprovedReviews: () => {
    return db.prepare('SELECT id, name, review, rating, role, created_at FROM reviews WHERE is_approved = 1 ORDER BY id DESC').all();
  },

  getAllReviews: () => {
    return db.prepare('SELECT id, name, review, rating, role, is_approved, created_at FROM reviews ORDER BY id DESC').all();
  },

  addReview: ({ name, review, rating, role = 'Client / Collaborator' }) => {
    const stmt = db.prepare(`
      INSERT INTO reviews (name, review, rating, role, is_approved)
      VALUES (?, ?, ?, ?, 1)
    `);
    const info = stmt.run(name, review, rating, role);
    return db.prepare('SELECT id, name, review, rating, role, created_at FROM reviews WHERE id = ?').get(info.lastInsertRowid);
  },

  deleteReview: (id) => {
    const stmt = db.prepare('DELETE FROM reviews WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  },

  // CV Management
  getActiveCv: () => {
    return db.prepare(`
      SELECT id, original_name, filename, file_path, file_size, mime_type, uploaded_at
      FROM cv_files
      WHERE is_active = 1
      ORDER BY id DESC
      LIMIT 1
    `).get();
  },

  setActiveCv: ({ original_name, filename, file_path, file_size, mime_type = 'application/pdf' }) => {
    // Transactionally deactivate older CVs and activate new one
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare('UPDATE cv_files SET is_active = 0 WHERE is_active = 1').run();
      const insert = db.prepare(`
        INSERT INTO cv_files (original_name, filename, file_path, file_size, mime_type, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      const info = insert.run(original_name, filename, file_path, file_size, mime_type);
      db.exec('COMMIT;');
      return db.prepare('SELECT id, original_name, filename, file_path, file_size, mime_type, uploaded_at FROM cv_files WHERE id = ?').get(info.lastInsertRowid);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  // Admin and Auth
  getAdminByUsername: (username) => {
    return db.prepare('SELECT id, username, password_hash, salt FROM admin_users WHERE username = ?').get(username);
  },

  getAdminById: (id) => {
    return db.prepare('SELECT id, username, created_at FROM admin_users WHERE id = ?').get(id);
  },

  updateAdminPassword: (userId, newPassword) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword, salt);
    db.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, userId);
  },

  createSession: (userId, token, expiresAt) => {
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, userId, expiresAt);
  },

  getSession: (token) => {
    return db.prepare(`
      SELECT s.token, s.user_id, s.expires_at, u.username
      FROM sessions s
      JOIN admin_users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `).get(token, Date.now());
  },

  deleteSession: (token) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  cleanExpiredSessions: () => {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  },

  verifyPassword
};

module.exports = dbQueries;
