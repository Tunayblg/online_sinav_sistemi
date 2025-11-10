# Online Exam Management System

A comprehensive, enterprise-grade online examination platform designed for educational institutions. This full-stack application provides a complete solution for managing exams, students, teachers, and academic workflows with advanced features and robust security.

## 🚀 Key Features

### Multi-Role Dashboard System
- **Student Dashboard**: View enrolled lessons, take timed exams, track grades, and monitor academic progress
- **Teacher Dashboard**: Create and manage exams, upload questions via Excel, grade submissions, and view student performance analytics
- **Department Head Dashboard**: Oversee department-wide operations, manage lessons, and access comprehensive reports
- **Admin Dashboard**: Full system administration with user management, role assignments, and system-wide configurations

### Advanced Exam Management
- ⏱️ **Timed Exam System**: Configurable time limits with automatic submission when time expires
- 📝 **Random Question Selection**: Automatic randomization of questions for each student to prevent cheating
- 📊 **Automatic Grade Calculation**: Instant scoring and grade computation upon exam submission
- 🔄 **Single Attempt Control**: Prevents multiple attempts with intelligent attempt tracking
- 📅 **Scheduled Exams**: Set start and end times for exams with automatic availability control

### Bulk Operations & Data Management
- 📥 **Excel Import**: Bulk upload questions and users from Excel files (XLSX format)
- 👥 **User Management**: Comprehensive user administration with role-based access control
- 📚 **Lesson Management**: Organize courses and lessons with student enrollment tracking
- 🔍 **Advanced Filtering**: Search and filter capabilities across all modules

### Security & Authentication
- 🔒 **JWT-Based Authentication**: Secure token-based authentication with refresh token support
- 🛡️ **Role-Based Access Control (RBAC)**: Granular permissions for different user roles
- 🔐 **Password Encryption**: Bcrypt hashing for secure password storage
- 🌐 **CORS Protection**: Configured cross-origin resource sharing for API security

## 🛠️ Technology Stack

### Backend
- **Framework**: Flask 3.0.0
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: Flask-JWT-Extended 4.6.0
- **Migrations**: Flask-Migrate 4.0.5
- **Security**: Bcrypt 4.1.2 for password hashing
- **Environment**: Python-dotenv for configuration management

### Frontend
- **Framework**: React 18.2.0
- **Routing**: React Router DOM 6.20.0
- **Excel Processing**: XLSX.js 0.18.5
- **Build Tool**: Create React App

## 📦 Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 14+
- PostgreSQL 12+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
Create a `.env` file in the `backend` directory with the following variables:
```env
DB_URL=postgresql://username:password@localhost:5432/dbname
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRES=3600
JWT_REFRESH_EXPIRES=604800
```

4. Initialize the database:
```bash
python init.py
```

5. Run the Flask application:
```bash
python app.py
```

The backend API will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend application will be available at `http://localhost:3000`

## 🎯 Usage

### For Administrators
- Manage users and assign roles (Student, Teacher, Department Head, Admin)
- Configure system-wide settings
- Monitor system activity and performance
- Import bulk users via Excel

### For Teachers
- Create exams with custom time limits and question counts
- Upload questions in bulk using Excel templates
- View and grade student submissions
- Track student performance across exams
- Manage lesson enrollments

### For Students
- View enrolled lessons and upcoming exams
- Take timed exams with real-time countdown
- View exam results and grades
- Track academic progress

### For Department Heads
- Oversee department operations
- Access comprehensive reports
- Manage department lessons and courses

## 📋 Excel Import Format

### Questions Import
The Excel file should contain the following columns:
- Question text
- Option A, B, C, D (multiple choice options)
- Correct answer (A, B, C, or D)
- Points (numeric value)

### Users Import
The Excel file should contain:
- Full name
- Email
- Password (will be hashed automatically)
- Role (student, teacher, department_head, admin)

## 🔧 API Endpoints

The system provides RESTful API endpoints for:
- Authentication (`/api/auth/login`, `/api/auth/refresh`)
- User management (`/api/admin/users`)
- Exam management (`/api/teacher/exams`, `/api/teacher/questions`)
- Student operations (`/api/student/exams`, `/api/student/lessons`)
- Department operations (`/api/department-head/*`)

## 🎨 Architecture Highlights

- **Modular Design**: Clean separation between frontend and backend
- **Database Migrations**: Version-controlled database schema changes
- **Error Handling**: Comprehensive error handling and validation
- **Responsive UI**: Modern, user-friendly interface built with React
- **Scalable Architecture**: Designed to handle large numbers of concurrent users

## 🔐 Security Features

- JWT token-based authentication with expiration
- Password hashing using bcrypt
- Role-based access control
- SQL injection prevention via ORM
- CORS configuration for API security
- Environment variable management for sensitive data

## 📈 Performance & Scalability

- Efficient database queries with SQLAlchemy ORM
- Optimized React component rendering
- Token-based stateless authentication
- Database indexing for fast lookups
- Bulk operations support for large datasets

## 🤝 Contributing

This is a production-ready system designed for educational institutions. For customizations or enhancements, please ensure:
- Code follows existing patterns and conventions
- Database migrations are properly versioned
- Security best practices are maintained
- Tests are added for new features

## 📄 License

This project is designed for educational and institutional use.

---
