# Heba Ayman - Full Stack .NET Developer Portfolio 🚀

A modern, responsive, and interactive personal portfolio showcasing projects, technical skills, achievements, and experience in Full Stack .NET & Modern Web Development.

---

## 🌟 Features

- 🎨 **Modern Design & Visual Aesthetics**: Custom dark/light mode theming with smooth color transitions and glowing accents.
- ⚡ **Interactive Elements**: Interactive mouse follower, dynamic particle background canvas, and smooth scroll animations.
- 📱 **Fully Responsive**: Optimized for desktop, tablet, and mobile devices.
- 💼 **Project Showcases**: Detailed project cards with live demo and source code links.
- 🛠️ **Tech Stack Highlights**: Displays proficiency in C#, ASP.NET Core, SQL Server, JavaScript, CSS3, and HTML5.
- 📬 **Interactive Contact Section**: Direct contact and social links.
- ⭐ **Client Reviews & Testimonials System (New)**:
  - Interactive 5-star rating picker with hover effects and client feedback form.
  - Immediate real-time display of newly submitted reviews without requiring a page reload.
  - Real, persistent database storage using SQLite (`data/portfolio.db`).
  - Server-side input validation, length limits, rate-limiting, and XSS sanitization.
- 📄 **CV Download & Private CV Management (New)**:
  - Prominent **Download CV** button in the hero section pointing to `/api/cv/download`.
  - Serves genuine PDF document with attachment headers.
  - Authenticated Private Management Portal (`/admin`) for the portfolio owner.
  - Secure file upload with strict PDF validation (MIME type, `.pdf` extension, and `%PDF-` magic bytes verification).
  - Atomic replacement preserving existing CV until new upload is validated and stored.
  - Review moderation panel allowing deletion of spam or inappropriate submissions.

---

## 💻 Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System, Glassmorphism, CSS Variables), JavaScript (ES6+)
- **Backend**: Node.js & Express REST API
- **Database**: SQLite (Node native `node:sqlite` DatabaseSync)
- **File Storage**: Local persistent storage (`uploads/cv/`)

---

## 🚀 Quick Start & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` to customize administrator credentials and port:
```ini
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@Heba2026!
SESSION_SECRET=your_secure_session_secret_here
```

### 3. Start the Application Server
```bash
npm start
```
The application will be accessible at:
- **Public Portfolio**: [http://localhost:3000](http://localhost:3000)
- **Admin Management Portal**: [http://localhost:3000/admin](http://localhost:3000/admin)

### 4. Run Automated Test Suite
To verify database persistence, file uploads, CV downloads, authentication, and security:
```bash
npm test
```

---

## 🔐 Administrative Access & Management

- **URL**: Navigate to `/admin` or click the **Admin** link in the footer.
- **Default Username**: `admin` (or defined in `.env`)
- **Default Password**: `Admin@Heba2026!` (or defined in `.env`)
- **Features in Admin Portal**:
  - View active production CV file name, file size, and upload date.
  - Download or preview current active CV.
  - Drag-and-drop or browse to upload a new PDF resume (up to 15MB).
  - View all client reviews submitted through the website with the option to moderate/delete unwanted entries.

---

## 👤 Author

**Heba Ayman**  
Full Stack .NET Developer | Computer Science Student
