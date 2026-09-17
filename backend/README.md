
# TaskHub - Multi-Tenant Task Management System

A full-stack task management application where multiple organizations can use the same deployment while keeping their data completely isolated.

---

## 📋 Quick Overview

**What is TaskHub?**
- Organizations can manage tasks (to-dos)
- Each org's data is completely separate
- Same code, same database, but isolated data

**Why it matters?**
- Learn backend + frontend development
- Understand multi-tenant architecture
- Practice authentication & security

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- PostgreSQL v12+
- Git
- VS Code (recommended)

### Installation

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env and add your PostgreSQL password

# 4. Start server
npm run dev

# 5. Test it
# Open browser: http://localhost:3001
# Should see: { "message": "TaskHub Backend is running!" }
```

---

## 🏗️ Complete Project Structure

taskhub/
│
├── backend/ # Node.js + Express API
│ ├── src/
│ │ └── server.ts # Main Express server
│ │
│ ├── node_modules/ # Installed packages (400MB+)
│ │
│ ├── package.json # Project config & dependencies
│ ├── package-lock.json # Locked versions
│ ├── tsconfig.json # TypeScript config
│ │
│ ├── .env # Secrets (NOT in Git!)
│ ├── .env.example # Template for .env
│ ├── .gitignore # Tell Git what to ignore
│
├── frontend/ # React app (coming soon)
│ └── (not yet created)
│
├── .git/ # Git repository (auto-created)
├── .gitignore # Root-level ignore rules
├── README.md # This file
│
└── Commits Made:
✅ 3 commits with clear messages


---

## 📁 Complete File Reference

### **BACKEND FILES**

---

### `backend/src/server.ts` ⭐

**What it is:** The main entry point of your backend server.

**What it does:**
```typescript
// 1. Import libraries
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 2. Load environment variables from .env
dotenv.config();

// 3. Create Express app
const app = express();

// 4. Add middleware
app.use(cors());           // Allow cross-origin requests
app.use(express.json());   // Parse JSON bodies

// 5. Define routes
app.get('/', (req, res) => {
  res.json({ message: 'TaskHub Backend is running!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 6. Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});
```

**Current Status:** ✅ Working  
**Test it:** Visit http://localhost:3001

---

### `backend/package.json` 📦

**What it is:** Project metadata and dependency list.

**Key parts:**

```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  
  "scripts": {
    "dev": "ts-node src/server.ts",      // Development
    "build": "tsc",                       // Compile TypeScript
    "start": "node dist/server.js"        // Run compiled version
  },
  
  "dependencies": {
    "express": "^4.21.1",                // Web server
    "cors": "^2.8.5",                    // Cross-origin requests
    "dotenv": "^17.4.2",                 // Load .env
    "bcrypt": "^6.0.0",                  // Hash passwords
    "jsonwebtoken": "^9.0.3",            // JWT tokens
    "pg": "^8.23.0"                      // PostgreSQL driver
  },
  
  "devDependencies": {
    "typescript": "^5.3.3",              // TypeScript compiler
    "ts-node": "^10.9.2",                // Run TypeScript
    "@types/node": "^20.0.0",            // Node types
    "@types/express": "^4.17.21"         // Express types
  }
}
```

**Why it matters:** Defines what to install and what commands to run  
**Current Status:** ✅ Configured

---

### `backend/.env` 🔐

**What it is:** Secret environment variables (NEVER commit to Git!)

**Content:**

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/taskhub_db
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
PORT=3001
NODE_ENV=development


**⚠️ IMPORTANT:**
- Replace `YOUR_PASSWORD` with your PostgreSQL password
- NEVER commit this file
- NEVER share this file
- It's in .gitignore for a reason!

**Current Status:** ✅ Created

---

### `backend/.env.example` 📋

**What it is:** Template showing what .env should contain (SAFE to commit)

**Content:**

DATABASE_URL=postgresql://postgres:your_password@localhost:5432/taskhub_db
JWT_SECRET=your_secret_key
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
PORT=3001
NODE_ENV=development


**Why separate file?**
- Developers see what variables are needed
- No actual secrets exposed
- Safe to commit to GitHub
- Other team members can see what to configure

**Current Status:** ✅ Created

---

### `backend/tsconfig.json` ⚙️

**What it is:** TypeScript compiler configuration

**Key settings:**
```json
{
  "compilerOptions": {
    "target": "ES2020",                    // Modern JavaScript
    "module": "commonjs",                  // Module format
    "lib": ["ES2020"],                     // Standard library
    "outDir": "./dist",                    // Output folder
    "rootDir": "./src",                    // Source folder
    "strict": false,                       // Flexible typing (easier to learn)
    "esModuleInterop": true,               // Better npm compatibility
    "skipLibCheck": true,                  // Skip type checking dependencies
    "forceConsistentCasingInFileNames": true  // Consistent naming
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Why it matters:** Tells TypeScript how to compile your code  
**Current Status:** ✅ Configured

---

### `backend/package-lock.json` 🔒

**What it is:** Lock file for dependency versions

**Why it exists:**
- When you run `npm install`, it installs exact versions listed here
- Ensures everyone gets same versions
- Prevents "works on my machine" problems

**Should you edit it?** ❌ NO (auto-generated)  
**Should you commit it?** ✅ YES (very important)

**Current Status:** ✅ Auto-generated (133 packages)

---

### `backend/.gitignore` 🚫

**What it is:** Tell Git which files to ignore

**Content:**

node_modules/ # Dependencies (400MB+, can reinstall)
.env # SECRETS! NEVER commit!
dist/ # Compiled files (can regenerate)
build/ # Build artifacts
.DS_Store # macOS system files
*.log # Log files


**Why it matters:**
- `.env` file is NOT committed (secrets stay secret!)
- `node_modules` is NOT committed (too large)
- `dist` is NOT committed (can regenerate by running build)

**Current Status:** ✅ Configured

---

### `backend/node_modules/` 📚

**What it is:** Folder containing all installed npm packages

**Contains:**
- express, cors, bcrypt, jsonwebtoken, pg
- typescript, ts-node
- Hundreds of their dependencies

**Size:** ~400MB (HUGE!)  
**Committed to Git?** ❌ NO (in .gitignore)  
**How to get it?** Run: `npm install`

**Current Status:** ✅ Installed

---

### **ROOT FOLDER FILES**

---

### `README.md` 📖

**What it is:** Project documentation (this file!)

**Contains:**
- Overview and getting started
- Project structure
- File explanations
- Tech stack
- Status
- Next steps
- Commands

**Why it matters:** Helps everyone (including future you) understand the project

**Current Status:** ✅ Created and detailed

---

### `.gitignore` 🚫

**What it is:** Root-level ignore rules

**Content:**

node_modules/
.env
dist/
build/


**Current Status:** ✅ Created

---

### `.git/` 🔐

**What it is:** Git repository (created by `git init`)

**Contains:**
- All your commits
- Branch information
- Configuration

**Don't touch this folder!**

**Current Status:** ✅ Initialized

---

## 🔄 How Everything Works Together

You run: npm run dev
⬇️
npm reads: package.json (looks for "dev" script)
⬇️
Executes: ts-node src/server.ts
⬇️
ts-node reads: tsconfig.json (how to compile TypeScript)
⬇️
ts-node loads: dotenv
⬇️
dotenv reads: .env (loads SECRET variables)
⬇️
server.ts runs: Express starts listening on PORT 3001
⬇️
Terminal shows: ✓ Server running on http://localhost:3001 ✅


---

## 📊 Current Status (Phase 1: ✅ COMPLETE)

### ✅ Completed
- [x] Backend folder structure
- [x] Express server setup and running
- [x] TypeScript configuration
- [x] All dependencies installed
- [x] Environment variables (.env)
- [x] Server running on port 3001
- [x] Git repository initialized
- [x] 3+ commits with clear messages
- [x] Comprehensive README

### 🔄 Phase 2: In Progress (Next)
- [ ] PostgreSQL database setup
- [ ] Database schema design
- [ ] Create tables (Tenants, Users, Projects, Tasks)

### ❌ Phase 3 & Beyond: Not Started
- [ ] Authentication (signup/login)
- [ ] CRUD API endpoints
- [ ] Frontend (React)
- [ ] Tests
- [ ] Deployment

---

## 🛠️ Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | v24.21.0 | Execute JavaScript/TypeScript |
| **Framework** | Express | v4.21.1 | Web server & routing |
| **Language** | TypeScript | v5.3.3 | Type-safe JavaScript |
| **Database** | PostgreSQL | v12+ | Data storage (not yet connected) |
| **Auth** | JWT | jsonwebtoken | Authentication tokens |
| **Security** | bcrypt | v6.0.0 | Hash passwords |

---

## 🔗 All Useful Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Compile TypeScript to JavaScript
npm start            # Run compiled version
```

### Testing
```bash
curl http://localhost:3001           # Test server
curl http://localhost:3001/health    # Health check
```

### Git
```bash
git status           # See what changed
git add .            # Stage changes
git commit -m "..."  # Save changes
git log --oneline    # View commit history
git show HEAD        # See latest commit details
```

### Node/Package
```bash
npm install          # Install dependencies
npm list             # View installed packages
npm update           # Update packages
```

---

## 📝 Next Steps (Phase 2: Database)

### Step 1: Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE taskhub_db;

# List databases
\l

# Exit
\q
```

### Step 2: Design Schema
Tables needed:
- **Tenants** — Organizations using the app
- **Users** — People (belong to one tenant)
- **Projects** — Groups of tasks
- **Tasks** — Individual to-dos

### Step 3: Update Backend
- Connect Express to PostgreSQL
- Create database migrations
- Set up data isolation logic

### Step 4: Build Authentication
- POST /auth/signup — Register new user
- POST /auth/login — Login and get JWT token
- JWT validation middleware
- Password hashing with bcrypt

### Step 5: Build CRUD Endpoints
- GET /projects — List projects
- POST /projects — Create project
- GET /tasks — List tasks
- POST /tasks — Create task
- PATCH /tasks/:id — Update task
- DELETE /tasks/:id — Delete task

---

## 🎯 Key Concepts to Remember

### Multi-Tenancy
Each organization's data is **completely separate** even though they use the same code:

Company A sees only: Tasks from Company A
Company B sees only: Tasks from Company B
(They can't see each other's data)


### JWT Authentication

User logs in → Backend creates JWT token → User stores token
User makes request → Token sent with request
Backend validates token → Allows/denies request


### Password Security

User enters password: "secret123"
⬇️
bcrypt hashes it: "$2b$10$..." (irreversible)
⬇️
Stored in database (actual password NEVER stored!)


---

## 💡 Important Notes

### Security
- Never commit `.env` file ❌
- never hardcode secrets in code ❌
- Always hash passwords with bcrypt ✅
- Always validate JWT tokens ✅
- Always scope queries by tenant_id ✅

### Development
- Make frequent commits ✅
- Write clear commit messages ✅
- Test as you build ✅
- Ask questions if unclear ✅

### Best Practices
- Keep `server.ts` simple, move logic to separate files later
- Use proper error handling
- Validate all user inputs
- Add tests before shipping

---

## 🔗 Useful Links

- Express.js: https://expressjs.com/
- TypeScript: https://www.typescriptlang.org/
- PostgreSQL: https://www.postgresql.org/docs/
- JWT: https://jwt.io/
- Git: https://git-scm.com/

---

## 📞 Quick Reference

**Current server:** http://localhost:3001  
**Database:** PostgreSQL (not yet connected)  
**Current commits:** 3+  
**Time invested:** ~1 hour  
**Time estimate to MVP:** 2-3 days  

---

## ✨ Summary

### What You Have
✅ Working Express server  
✅ TypeScript configured  
✅ Dependencies installed  
✅ Git tracking changes  
✅ Clear documentation  

### What You're Building
A full-stack multi-tenant app where companies can manage tasks securely.

### Next Session
Start with Phase 2: Database setup and design.

---

**Last Updated:** September 17, 2026  
**Status:** Phase 1 Complete ✅  
**Next Phase:** Database & Schema Design  
**Estimated Time:** 30 minutes for database, 1 hour for schema design  

---
