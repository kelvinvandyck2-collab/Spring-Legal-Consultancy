# Spring Legal Consultancy - Complete Full-Stack Application

A complete full-stack application for Spring Legal Consultancy with clean URLs and comprehensive backend functionality.

## 🏗️ Project Structure

```
Law Firm/
├── backend/                    # Node.js API server
│   ├── package.json
│   ├── server.js               # Main API server with contact form
│   ├── .env.example             # Environment variables template
│   └── setup.bat/.sh           # Setup scripts
│
├── frontend/                   # Frontend server (clean URLs)
│   ├── package.json
│   ├── frontend-server.js        # Express server with clean URLs
│   └── setup.bat/.sh           # Setup scripts
│
├── *.html                      # All website pages
├── css/, js/, img/, fonts/    # Static assets
└── quform/, search/           # Form and search components
```

## 🚀 Quick Start

### **Option 1: Automated Setup**
```bash
# Setup backend with database and email
cd backend && setup.bat    # Windows
cd backend && ./setup.sh   # Linux/Mac

# Setup frontend server
cd frontend && setup.bat     # Windows  
cd frontend && ./setup.sh   # Linux/Mac
```

### **Option 2: Manual Setup**

#### **Backend Setup:**
1. Install Node.js dependencies: `npm install`
2. Configure environment: `cp .env.example .env`
3. Setup PostgreSQL database
4. Start backend: `npm start`

#### **Frontend Setup:**
1. Install Node.js dependencies: `npm install`
2. Start frontend: `npm start`

## 🌐 Access URLs

### **Development:**
- **Frontend**: `http://localhost:3001`
- **Backend API**: `http://localhost:8000`
- **API Documentation**: `http://localhost:8000/docs`

### **Clean URLs Feature:**
- ✅ `http://localhost:3001/` (instead of `/index.html`)
- ✅ `http://localhost:3001/contact` (instead of `/contact.html`)
- ✅ `http://localhost:3001/about` (instead of `/about.html`)
- All pages accessible without `.html` extension

## 🔧 Backend Features

### **Contact Form API:**
- **POST** `/api/v1/contact` - Submit contact form
- **GET** `/api/v1/contact` - Get all contacts
- **Email Notifications**: Automatic via Hostinger SMTP
- **Database**: PostgreSQL with connection pooling
- **Validation**: Input validation and sanitization
- **Security**: Rate limiting, CORS, security headers

### **Database Schema:**
```sql
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);
```

## 📧 Frontend Features

### **Clean URLs:**
- No `.html` extension in URLs
- Express routing for all pages
- Static file serving with proper headers
- API proxy to backend server

### **Contact Form Integration:**
- Frontend form submits to: `http://localhost:3001/api/v1/contact`
- Backend processes and stores in database
- Email notifications sent to admin
- Success/error feedback to user

## 🔒 Security Features

- **CORS**: Configured for frontend domains
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Email format and required fields
- **SQL Injection Protection**: Parameterized queries
- **Security Headers**: Helmet.js middleware

## 📊 Environment Configuration

### **Required Environment Variables:**
```env
# Database
DATABASE_URL=postgresql://postgres:Godlovesme1@localhost:5432/spring_legal_db

# Email (Hostinger)
SMTP_SERVER=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USERNAME=support@winningedgeinvestment.com
SMTP_PASSWORD=Brutality@54
FROM_EMAIL=support@winningedgeinvestment.com
TO_EMAIL=support@winningedgeinvestment.com

# Application
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:8000
PORT=3001
SECRET_KEY=your-secret-key-here
```

## 🚀 Deployment

### **Development:**
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:8000`
- Database: Local PostgreSQL

### **Production:**
- Set `NODE_ENV=production`
- Configure reverse proxy (nginx/Apache)
- Use PostgreSQL connection pooling
- Enable SSL certificates
- Set proper CORS origins

## 📧 API Endpoints

### **Contact Form:**
- `POST /api/v1/contact` - Create contact submission
- `GET /api/v1/contact` - List all contacts (admin)
- `GET /api/v1/contact/:id` - Get specific contact
- `PUT /api/v1/contact/:id/mark-read` - Mark as read
- `DELETE /api/v1/contact/:id` - Delete contact

### **System:**
- `GET /` - API status
- `GET /health` - Health check

## 📝 Testing

### **Test Contact Form:**
```bash
curl -X POST http://localhost:3001/api/v1/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Legal Consultation",
    "message": "I need help with corporate law matters"
  }'
```

## 🔄 Development Workflow

1. **Start Backend**: `cd backend && npm start`
2. **Start Frontend**: `cd frontend && npm start`
3. **Test Integration**: Submit contact form through frontend
4. **Check Database**: Verify contact submissions are stored
5. **Check Email**: Verify notifications are sent

## 🎯 Benefits

### **Full-Stack Integration:**
- ✅ **Clean URLs**: Professional URLs without extensions
- ✅ **Contact Form**: Complete email notification system
- ✅ **Database**: Robust PostgreSQL integration
- ✅ **Security**: Comprehensive protection measures
- ✅ **Scalability**: Ready for production deployment
- ✅ **Development**: Hot reload and easy debugging

## 📞 Support

For issues or questions:
1. Check API documentation: `http://localhost:8000/docs`
2. Review logs in terminal
3. Test endpoints individually
4. Verify database connections
5. Check email configuration

---

**Spring Legal Consultancy** - Professional web presence with modern full-stack architecture.
# SLWPINK
