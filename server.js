const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const multer = require('multer');

// Simple .env parser to avoid extra dependency issues
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const db = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Security, CORS and utility headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON and URL-encoded body parser
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Cookie parser helper
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift().trim();
    const val = decodeURI(parts.join('='));
    if (name) list[name] = val;
  });
  return list;
}

app.use((req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
});

// In-memory rate limiter for review submissions
const rateLimitMap = new Map();
function reviewRateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 10;

  const userRecord = rateLimitMap.get(ip) || [];
  const recentRequests = userRecord.filter((timestamp) => now - timestamp < windowMs);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      error: 'You have submitted too many reviews recently. Please wait a few minutes before trying again.'
    });
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  next();
}

// XSS Sanitizer for plain text inputs
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Authentication Middleware
function requireAdminAuth(req, res, next) {
  let token = req.cookies.portfolio_admin_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }

  const session = db.getSession(token);
  if (!session) {
    // Clear stale cookie
    res.setHeader('Set-Cookie', 'portfolio_admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  req.admin = {
    userId: session.user_id,
    username: session.username,
    token: session.token
  };
  next();
}

// Multer memory storage for CV upload verification
const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB maximum
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Invalid file type: Only PDF files (.pdf) are permitted.'));
    }
    cb(null, true);
  }
});

// ============================================================================
// API ROUTES: CLIENT REVIEWS
// ============================================================================

// GET /api/reviews - Retrieve all approved client reviews
app.get('/api/reviews', (req, res) => {
  try {
    const reviews = db.getApprovedReviews();
    res.json({ success: true, reviews });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to load reviews from database.' });
  }
});

// POST /api/reviews - Submit a new review
app.post('/api/reviews', reviewRateLimiter, (req, res) => {
  try {
    let { name, review, rating, role } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name is required and must be at least 2 characters.' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Name cannot exceed 100 characters.' });
    }

    // Validate review
    if (!review || typeof review !== 'string' || review.trim().length < 5) {
      return res.status(400).json({ error: 'Review is required and must be at least 5 characters.' });
    }
    if (review.trim().length > 1500) {
      return res.status(400).json({ error: 'Review cannot exceed 1500 characters.' });
    }

    // Validate rating (1 to 5)
    const numericRating = parseInt(rating, 10);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5 stars.' });
    }

    // Optional role
    const sanitizedRole = role && typeof role === 'string' && role.trim().length > 0
      ? sanitizeText(role.slice(0, 100))
      : 'Client / Collaborator';

    const sanitizedName = sanitizeText(name);
    const sanitizedReview = sanitizeText(review);

    const createdReview = db.addReview({
      name: sanitizedName,
      review: sanitizedReview,
      rating: numericRating,
      role: sanitizedRole
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your review has been submitted successfully.',
      review: createdReview
    });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'An unexpected database error occurred while saving your review.' });
  }
});

// ============================================================================
// API ROUTES: CV DOWNLOAD & PUBLIC METADATA
// ============================================================================

// GET /api/cv - Retrieve current active CV metadata
app.get('/api/cv', (req, res) => {
  try {
    const activeCv = db.getActiveCv();
    if (!activeCv) {
      return res.status(404).json({ error: 'No active CV found.' });
    }
    res.json({
      success: true,
      cv: {
        id: activeCv.id,
        original_name: activeCv.original_name,
        file_size: activeCv.file_size,
        uploaded_at: activeCv.uploaded_at,
        download_url: '/api/cv/download'
      }
    });
  } catch (err) {
    console.error('Error getting CV info:', err);
    res.status(500).json({ error: 'Failed to retrieve CV information.' });
  }
});

// GET /api/cv/download - Download the current active CV PDF
app.get('/api/cv/download', (req, res) => {
  try {
    const activeCv = db.getActiveCv();
    if (!activeCv) {
      return res.status(404).send('CV file is not currently available.');
    }

    const fullPath = path.isAbsolute(activeCv.file_path)
      ? activeCv.file_path
      : path.join(__dirname, activeCv.file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('The requested CV file does not exist on the server.');
    }

    const stat = fs.statSync(fullPath);
    const safeFilename = activeCv.original_name.replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error downloading CV:', err);
    res.status(500).send('An error occurred while serving the CV.');
  }
});

// GET /api/cv/view - Inline view of CV in browser tab
app.get('/api/cv/view', (req, res) => {
  try {
    const activeCv = db.getActiveCv();
    if (!activeCv) {
      return res.status(404).send('CV file not found.');
    }

    const fullPath = path.isAbsolute(activeCv.file_path)
      ? activeCv.file_path
      : path.join(__dirname, activeCv.file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('File not found on server.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${activeCv.original_name}"`);
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).send('Error loading CV.');
  }
});

// ============================================================================
// API ROUTES: ADMIN AUTHENTICATION & MANAGEMENT
// ============================================================================

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = db.getAdminByUsername(username.trim());
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isValid = db.verifyPassword(password, admin.salt, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate 32-byte secure random session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    db.createSession(admin.id, token, expiresAt);

    // Set secure HttpOnly cookie
    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = `portfolio_admin_token=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookieHeader);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      username: admin.username
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req, res) => {
  const token = req.cookies.portfolio_admin_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (token) {
    try {
      db.deleteSession(token);
    } catch (err) {
      // Ignore
    }
  }
  res.setHeader('Set-Cookie', 'portfolio_admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/admin/me
app.get('/api/admin/me', requireAdminAuth, (req, res) => {
  res.json({
    authenticated: true,
    username: req.admin.username
  });
});

// POST /api/admin/cv/upload - Upload and replace CV (Protected)
app.post('/api/admin/cv/upload', requireAdminAuth, (req, res) => {
  uploadCv.single('cvFile')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum allowed limit (15MB).' });
      }
      return res.status(400).json({ error: err.message || 'File upload error.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file was provided. Please choose a valid PDF file.' });
    }

    // Verify PDF Magic Bytes (%PDF-)
    if (req.file.buffer.length < 5 || req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(400).json({
        error: 'Security verification failed: Uploaded file is not a genuine PDF document.'
      });
    }

    try {
      const originalName = req.file.originalname || 'CV_Heba_Allah_Ayman.pdf';
      const timestamp = Date.now();
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `CV_${timestamp}_${sanitizedName}`;
      const destinationPath = path.join(__dirname, 'uploads', 'cv', filename);

      // Write newly uploaded PDF to disk
      fs.writeFileSync(destinationPath, req.file.buffer);

      // Save atomically in database
      const relativePath = path.join('uploads', 'cv', filename).replace(/\\/g, '/');
      const updatedCv = db.setActiveCv({
        original_name: originalName,
        filename: filename,
        file_path: relativePath,
        file_size: req.file.buffer.length,
        mime_type: 'application/pdf'
      });

      res.json({
        success: true,
        message: 'CV uploaded and updated successfully!',
        cv: {
          id: updatedCv.id,
          original_name: updatedCv.original_name,
          file_size: updatedCv.file_size,
          uploaded_at: updatedCv.uploaded_at,
          download_url: '/api/cv/download'
        }
      });
    } catch (saveErr) {
      console.error('Error saving CV file:', saveErr);
      res.status(500).json({ error: 'Failed to save uploaded CV file to persistent storage.' });
    }
  });
});

// GET /api/admin/reviews - Admin view of all reviews
app.get('/api/admin/reviews', requireAdminAuth, (req, res) => {
  try {
    const reviews = db.getAllReviews();
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// DELETE /api/admin/reviews/:id - Admin delete/moderate review
app.delete('/api/admin/reviews/:id', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid review ID.' });
    }

    const deleted = db.deleteReview(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    res.json({ success: true, message: 'Review deleted successfully.' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: 'Failed to delete review.' });
  }
});

// ============================================================================
// PAGE ROUTES & STATIC ASSETS
// ============================================================================

// Admin page route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Static assets
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

// Fallback 404 handler
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Heba Ayman Portfolio Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Admin Portal: http://localhost:${PORT}/admin`);
  console.log(`====================================================`);
});

module.exports = { app, server };
