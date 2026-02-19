const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
app.set('trust proxy', 1); // Required for Vercel/Proxies to handle secure cookies
const PORT = process.env.PORT || 3001;

// Database configuration
let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  } catch (error) {
    connectionString = connectionString.replace('?sslmode=require', '').replace('&sslmode=require', '');
  }
}

const dbConfig = connectionString
  ? { 
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'spring_legal_db',
      password: process.env.DB_PASSWORD || 'Godlovesme1@',
      port: process.env.DB_PORT || 5432,
    };
const pool = new Pool(dbConfig);

// Initialize database table
pool.query(`
  CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(async () => {
    console.log('Database initialized');
    // Migration: Add status column if it doesn't exist (for existing tables)
    try {
      await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'new'`);
    } catch (e) { console.log('Migration note:', e.message); }

    // Create replies table for conversation history
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS replies (
          id SERIAL PRIMARY KEY,
          contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Replies table initialized');
    } catch (e) { console.log('Replies table note:', e.message); }
  })
  .catch(err => {
    console.error('Database initialization error:', err);
    if (err.message && err.message.includes('allow_list')) {
      console.error('🚨 ACTION REQUIRED: Your database is blocking Vercel IPs. Go to your Database Dashboard and allow 0.0.0.0/0.');
    }
  });

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://maps.google.com", "https://maps.googleapis.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://maps.google.com", "https://www.google.com"],
      connectSrc: ["'self'", "https://maps.google.com", "https://maps.googleapis.com"]
    },
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001', 'http://127.0.0.1:5501', 'http://localhost:5501'],
  credentials: true
}));

// Rate limiting (disabled for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for development
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for development
    return process.env.NODE_ENV !== 'production';
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving BEFORE routes - serve static files from root
// Explicitly serve each directory
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use('/quform', express.static(path.join(__dirname, 'quform')));
app.use('/search', express.static(path.join(__dirname, 'search')));

// General static file serving
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, filePath) => {
    // Cache static assets
    if (filePath.match(/\.(js|css|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year for versioned assets
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour for HTML
    }
  }
}));

// Email configuration (using nodemailer v8+)
let transporter;
try {
  if (nodemailer.createTransport) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      }
    });
  } else {
    // Fallback for older versions
    transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
} catch (error) {
  console.log('Email configuration error:', error.message);
  transporter = null;
}

// Verify email connection on startup
if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.warn('⚠️  Email server connection failed:', error.message);
      console.warn('   (Emails will not be sent. Check your .env file)');
      transporter = null;
    }
  });
}

// Middleware for requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Spring Legal Consultancy API', 
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// --- ADMIN ROUTES ---

// Middleware to verify Admin Token
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Admin Login
app.post('/api/v1/admin/login', (req, res) => {
  const { password } = req.body;
  // Set ADMIN_PASSWORD in your .env file. Default is 'admin123' if not set.
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'default_secret_key', { expiresIn: '2h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Get all contacts (Protected)
app.get('/api/v1/admin/contacts', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get contact history (original + replies)
app.get('/api/v1/admin/contacts/:id/history', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get original contact
    const contactResult = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
    if (contactResult.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    
    // Get replies
    const repliesResult = await pool.query('SELECT * FROM replies WHERE contact_id = $1 ORDER BY created_at ASC', [id]);
    
    res.json({
      contact: contactResult.rows[0],
      replies: repliesResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update contact status (Protected)
app.patch('/api/v1/admin/contacts/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query('UPDATE contacts SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete contact (Protected)
app.delete('/api/v1/admin/contacts/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reply to contact (Protected)
app.post('/api/v1/admin/reply', authenticateAdmin, async (req, res) => {
  const { id, email, subject, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Send email
    if (transporter) {
       await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USERNAME,
        to: email,
        subject: subject,
        html: `<div style="font-family: Arial, sans-serif; color: #333;">${message.replace(/\n/g, '<br>')}</div>`
      });
    }

    // Save reply to database for history
    await pool.query('INSERT INTO replies (contact_id, message) VALUES ($1, $2)', [id, message]);

    // Update status to replied
    await pool.query("UPDATE contacts SET status = 'replied' WHERE id = $1", [id]);

    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).json({ error: 'Failed to send reply: ' + err.message });
  }
});

// Contact form submission
app.post('/api/v1/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      console.error('❌ Contact Validation Failed: Missing fields', { body: req.body });
      return res.status(400).json({ error: 'Name, email, subject, and message are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Send email notification
    if (transporter) {
      const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: process.env.TO_EMAIL,
        subject: `New Contact Form Submission: ${subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><em>This message was sent from the Spring Legal Consultancy website contact form.</em></p>
        `
      };

      await transporter.sendMail(mailOptions);
    }

    // Store in database
    const insertQuery = `
      INSERT INTO contacts (name, email, phone, subject, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [name, email, phone, subject, message]);

    res.status(201).json({ 
      success: true, 
      message: 'Contact form submitted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Contact form error:', error);
    
    // Check for firewall/network restriction errors
    if (error.message && error.message.includes('allow_list')) {
      return res.status(500).json({ 
        error: 'Database Firewall Error', 
        details: 'Your database provider blocked the connection. Please go to your Database Dashboard > Network Restrictions and allow access from 0.0.0.0/0 (Anywhere).' 
      });
    }

    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Clean URL routes (without .html extension)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/attorney-details', (req, res) => {
  res.sendFile(path.join(__dirname, 'attorney-details.html'));
});

app.get('/our-attorneys', (req, res) => {
  res.sendFile(path.join(__dirname, 'our-attorneys.html'));
});

app.get('/our-history', (req, res) => {
  res.sendFile(path.join(__dirname, 'our-history.html'));
});

app.get('/our-pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'our-pricing.html'));
});

app.get('/testimonial', (req, res) => {
  res.sendFile(path.join(__dirname, 'testimonial.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'faq.html'));
});

app.get('/accordion', (req, res) => {
  res.sendFile(path.join(__dirname, 'accordion.html'));
});

app.get('/achievements', (req, res) => {
  res.sendFile(path.join(__dirname, 'achievements.html'));
});

app.get('/corporate-commercial-law', (req, res) => {
  res.sendFile(path.join(__dirname, 'corporate-commercial-law.html'));
});

app.get('/dispute-resolution-litigation', (req, res) => {
  res.sendFile(path.join(__dirname, 'dispute-resolution-litigation.html'));
});

app.get('/private-client-family', (req, res) => {
  res.sendFile(path.join(__dirname, 'private-client-family.html'));
});

app.get('/property-real-estate', (req, res) => {
  res.sendFile(path.join(__dirname, 'property-real-estate.html'));
});

app.get('/specialist-advisory-compliance', (req, res) => {
  res.sendFile(path.join(__dirname, 'specialist-advisory-compliance.html'));
});

app.get('/case-study-details', (req, res) => {
  res.sendFile(path.join(__dirname, 'case-study-details.html'));
});

app.get('/404-page', (req, res) => {
  res.sendFile(path.join(__dirname, '404-page.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Spring Legal Consultancy Full-Stack Server running on port ${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/v1/contact`);
    console.log(`🌐 Website: http://localhost:${PORT}`);
    console.log(`📝 Clean URLs (no .html extension)`);
    console.log(`📧 Email: ${transporter ? 'Configured' : 'Not configured'}`);
    console.log(`\n✅ Ready to serve both frontend and API!`);
  });
}

module.exports = app;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
