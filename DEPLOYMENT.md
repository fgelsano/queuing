# Deployment Guide for Queuing System

This guide will help you deploy the Queuing System to a production server using cPanel.

## Prerequisites

- Access to cPanel
- Domain name configured
- Node.js installed on your server (check via cPanel Terminal or contact hosting support)
- SSH access (recommended) or cPanel File Manager

## Step 1: Prepare Your Local Project

1. **Build the frontend:**

   ```bash
   cd frontend
   npm run build
   ```

   This creates a `dist` folder with production-ready files.

2. **Test the build locally (optional):**
   ```bash
   cd frontend
   npm run preview
   ```

## Step 2: Upload Files to Server

### Option A: Using cPanel File Manager

1. Log into cPanel
2. Navigate to **File Manager**
3. Go to your domain's root directory (usually `public_html` or `yourdomain.com`)
4. Upload the entire project folder or:
   - Upload `backend` folder
   - Upload `frontend/dist` folder (the built files)
   - Upload `package.json` files

### Option B: Using FTP/SFTP (Recommended)

1. Use an FTP client (FileZilla, Cyberduck, etc.)
2. Connect to your server
3. Upload:
   - `backend/` folder
   - `frontend/dist/` folder (built files)
   - Root `package.json` (if using workspaces)

### Option C: Using Git (If Available)

1. Initialize git repository on server
2. Clone your repository
3. Run build commands on server

## Step 3: Server Directory Structure

Your server structure should look like:

```
/home/username/
├── public_html/              # Frontend (React build)
│   ├── index.html
│   ├── assets/
│   └── ...
├── queing-backend/           # Backend (Node.js)
│   ├── server.js
│   ├── routes/
│   ├── prisma/
│   ├── uploads/
│   ├── videos/
│   ├── package.json
│   └── .env
└── ...
```

## Step 4: Configure Backend

1. **Navigate to backend directory on server:**

   ```bash
   cd ~/queing-backend
   ```

2. **Install dependencies:**

   ```bash
   npm install --production
   ```

3. **Create `.env` file:**

   ```bash
   nano .env
   ```

   Add these variables:

   ```env
   DATABASE_URL="file:./prisma/dev.db"
   JWT_SECRET="your-very-secure-secret-key-change-this"
   PORT=5002
   NODE_ENV=production
   ```

   **Important:**

   - Use a strong, random JWT_SECRET (generate with: `openssl rand -base64 32`)
   - For production, consider using PostgreSQL instead of SQLite

4. **Set up database:**

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npm run seed  # Only if you need initial data
   ```

5. **Create necessary directories:**
   ```bash
   mkdir -p uploads/logos
   mkdir -p uploads/profiles
   mkdir -p videos
   ```

## Step 5: Configure Frontend

1. **Update API endpoints** (if needed):

   - Check `frontend/src/utils/api.js` - it should use relative paths (`/api`)
   - If your backend is on a different subdomain, update the base URL

2. **Build the frontend on server** (or upload pre-built):

   ```bash
   cd ~/public_html  # or your frontend directory
   # If you uploaded source files:
   npm install
   npm run build
   ```

3. **Configure `.htaccess` for React Router** (if using Apache):
   Create `.htaccess` in `public_html`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

## Step 6: Set Up Process Manager (PM2)

1. **Install PM2 globally:**

   ```bash
   npm install -g pm2
   ```

2. **Create PM2 ecosystem file** (`ecosystem.config.cjs` in backend directory; use `.cjs` extension because the project uses `"type": "module"`):

   ```javascript
   module.exports = {
     apps: [
       {
         name: "queing-backend",
         script: "./server.js",
         cwd: "/home/username/queing-backend",
         instances: 1,
         exec_mode: "fork",
         env: {
           NODE_ENV: "production",
           PORT: 5002,
         },
         error_file: "./logs/err.log",
         out_file: "./logs/out.log",
         log_date_format: "YYYY-MM-DD HH:mm:ss Z",
         merge_logs: true,
         autorestart: true,
         watch: false,
       },
     ],
   };
   ```

3. **Start the application:**
   ```bash
   cd ~/queing-backend
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start on reboot
   ```

## Step 7: Configure Reverse Proxy (cPanel)

Since your frontend is on port 80/443 and backend on 5002, you need to proxy API requests.

### Option A: Using cPanel Subdomain

1. Create subdomain `api.yourdomain.com` pointing to backend directory
2. Configure reverse proxy in cPanel:
   - Go to **Subdomains**
   - Click on your subdomain
   - Enable **Reverse Proxy**
   - Target: `http://localhost:5002`

### Option B: Using .htaccess in public_html

Add to `.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On

  # Proxy API requests to backend
  RewriteCond %{REQUEST_URI} ^/api/(.*)$
  RewriteRule ^api/(.*)$ http://localhost:5002/api/$1 [P,L]

  # Proxy video requests
  RewriteCond %{REQUEST_URI} ^/videos/(.*)$
  RewriteRule ^videos/(.*)$ http://localhost:5002/videos/$1 [P,L]

  # Proxy upload requests
  RewriteCond %{REQUEST_URI} ^/uploads/(.*)$
  RewriteRule ^uploads/(.*)$ http://localhost:5002/uploads/$1 [P,L]

  # React Router (SPA)
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Note:** You may need to enable `mod_proxy` and `mod_rewrite` modules. Contact hosting support if needed.

## Step 8: SSL Certificate (HTTPS)

1. In cPanel, go to **SSL/TLS Status**
2. Install Let's Encrypt certificate (free)
3. Force HTTPS redirect in `.htaccess`:
   ```apache
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

## Step 9: Environment-Specific Configuration

### Backend `.env` (Production):

```env
DATABASE_URL="file:./prisma/production.db"
JWT_SECRET="your-production-secret-key"
PORT=5002
NODE_ENV=production
```

### Update Frontend API Base (if needed):

If backend is on different domain, update `frontend/src/utils/api.js`:

```javascript
const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.yourdomain.com/api"
    : "/api";
```

## Step 10: Security Checklist

- [ ] Change default admin password
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS
- [ ] Set proper file permissions (folders: 755, files: 644)
- [ ] Restrict access to `.env` file
- [ ] Update database credentials
- [ ] Remove or secure development endpoints
- [ ] Set up firewall rules if possible

## Step 11: Testing

1. **Test frontend:** Visit `https://yourdomain.com`
2. **Test API:** Visit `https://yourdomain.com/api/health`
3. **Test login:** Try admin and staff login
4. **Test queue:** Create a test queue entry
5. **Test video:** Verify video player works

## Step 12: Monitoring & Maintenance

1. **Check PM2 status:**

   ```bash
   pm2 status
   pm2 logs queing-backend
   ```

2. **Set up log rotation:**

   ```bash
   pm2 install pm2-logrotate
   ```

3. **Monitor disk space** (videos and uploads can grow)

4. **Regular backups:**
   - Database: `prisma/dev.db` or PostgreSQL dump
   - Uploads folder
   - Videos folder

## Database (SQLite) capacity and growth

The app uses SQLite by default. SQLite supports very large databases (theoretical limit is 281 TB); in practice the limit is your disk space.

**What grows over time:**

- **QueueEntry** – one row per client who joins the queue (queue number, name, category, status, timestamps). Roughly 300–500 bytes per row.
- **ServingLog** – one row per completed serve (staff, category, duration, etc.). Roughly 150–200 bytes per row.
- **DailyCounter** – one row per day (for queue number generation). Negligible.
- **WindowAssignment** – one row per staff–window assignment (history). Small.
- **Admin, Staff, Window, Category, SubCategory, Settings** – mostly static; size stays small.

**Rough capacity estimate:**

- Light use (e.g. 100 queue entries + 100 serving logs per day): ~50 KB/day → **1 GB ≈ 50+ years**.
- Heavy use (e.g. 1,000 entries + 1,000 logs per day): ~500 KB/day → **1 GB ≈ 5+ years**.
- Very heavy (e.g. 10,000 of each per day): ~5 MB/day → **1 GB ≈ 7 months**.

So for typical municipal or office use, a few GB of free disk is usually enough for many years. The main things to watch are disk space for the DB file, uploads (logos, sounds), and videos. For very high volume or long-term retention, consider switching to PostgreSQL (see “Alternative: Using PostgreSQL” in this guide).

## Troubleshooting

### Backend not starting:

- Check PM2 logs: `pm2 logs queing-backend`
- Verify Node.js version: `node --version` (needs 18+)
- Check port availability: `netstat -tulpn | grep 5002`
- Verify `.env` file exists and has correct values

### Frontend not loading:

- Check browser console for errors
- Verify `.htaccess` is configured correctly
- Check file permissions
- Verify build files are in correct directory

### API requests failing:

- Verify reverse proxy is configured
- Check backend is running: `pm2 status`
- Check CORS settings in `backend/server.js`
- Verify API base URL in frontend

### Database errors:

- Check database file permissions
- Verify Prisma migrations ran: `npx prisma migrate status`
- Check database path in `.env`

## Alternative: Using PostgreSQL (Recommended for Production)

1. **Create PostgreSQL database in cPanel:**

   - Go to **PostgreSQL Databases**
   - Create database and user
   - Note the connection string

2. **Update `backend/prisma/schema.prisma`:**

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. **Update `.env`:**

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
   ```

4. **Run migrations:**
   ```bash
   npx prisma migrate deploy
   ```

## Quick Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash
cd ~/queing-backend
npm install --production
npx prisma generate
npx prisma migrate deploy
pm2 restart queing-backend
```

Make it executable: `chmod +x deploy.sh`

## Support

If you encounter issues:

1. Check PM2 logs
2. Check cPanel error logs
3. Verify all environment variables
4. Test API endpoints directly
5. Contact hosting support for server-specific issues
