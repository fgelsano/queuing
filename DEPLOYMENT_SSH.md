# Complete SSH Deployment Guide for Queuing System

This is a comprehensive step-by-step guide to deploy the Queuing System to a production server using SSH.

## Prerequisites

- SSH access to your server
- Domain name configured and pointing to your server
- Node.js 18+ installed (check with `node --version`)
- npm installed (check with `npm --version`)
- Root or sudo access (for PM2 global install and nginx/Apache config)

---

## Step 1: Prepare Your Local Project

### 1.1 Build the Frontend

```bash
cd frontend
npm run build
```

This creates a `dist` folder with production-ready files. Verify it exists:
```bash
ls -la frontend/dist
```

### 1.2 (Optional) Test the Build Locally

```bash
cd frontend
npm run preview
```

Visit `http://localhost:4173` to verify everything works.

---

## Step 2: Connect to Your Server via SSH

```bash
ssh username@your-server-ip
# or
ssh username@yourdomain.com
```

Replace `username` with your SSH username and `your-server-ip` with your server's IP address.

---

## Step 3: Check Server Prerequisites

### 3.1 Check Node.js Version

```bash
node --version
```

**Required:** Node.js 18 or higher. If not installed or outdated:

```bash
# Using NodeSource (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### 3.2 Check npm

```bash
npm --version
```

### 3.3 Install PM2 Globally

```bash
sudo npm install -g pm2
```

Verify installation:
```bash
pm2 --version
```

---

## Step 4: Create Server Directory Structure

Decide where to place your application. Common locations:
- `/home/username/queing-backend` (backend)
- `/home/username/public_html` or `/var/www/html` (frontend)

### 4.1 Create Directories

```bash
# Create backend directory
mkdir -p ~/queing-backend
cd ~/queing-backend

# Create frontend directory (adjust path based on your web server)
mkdir -p ~/public_html
# OR if using Apache default:
# sudo mkdir -p /var/www/html/queing
```

---

## Step 5: Upload Files to Server

### Option A: Using SCP (Recommended for first-time deployment)

From your **local machine**, run:

```bash
# Upload backend
scp -r backend/* username@your-server-ip:~/queing-backend/

# Upload frontend build
scp -r frontend/dist/* username@your-server-ip:~/public_html/
```

### Option B: Using Git (Recommended for updates)

On your **server**:

```bash
# Install git if not available
sudo apt-get install git -y

# Clone your repository (if you have one)
cd ~
git clone https://github.com/yourusername/queing.git
cd queing

# Copy backend
cp -r backend/* ~/queing-backend/

# Copy frontend build (build locally first, then upload)
scp -r frontend/dist/* username@your-server-ip:~/public_html/
```

### Option C: Using rsync (Efficient for updates)

From your **local machine**:

```bash
# Upload backend
rsync -avz --exclude 'node_modules' --exclude 'prisma/dev.db' backend/ username@your-server-ip:~/queing-backend/

# Upload frontend build
rsync -avz frontend/dist/ username@your-server-ip:~/public_html/
```

---

## Step 6: Set Up Backend

### 6.1 Navigate to Backend Directory

```bash
cd ~/queing-backend
```

### 6.2 Install Dependencies

```bash
npm install --production
```

**Note:** If you get errors, you may need to install dev dependencies temporarily for Prisma:

```bash
npm install
```

### 6.3 Create `.env` File

```bash
nano .env
```

Add the following content (replace values as needed):

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="CHANGE-THIS-TO-A-RANDOM-SECRET-KEY"
PORT=5002
NODE_ENV=production
ELEVENLABS_API_KEY="your-elevenlabs-api-key-if-using-tts"
ELEVENLABS_VOICE_ID="your-voice-id-if-using-tts"
ELEVENLABS_SPEED=0.7
```

**Generate a secure JWT_SECRET:**

```bash
openssl rand -base64 32
```

Copy the output and paste it as your `JWT_SECRET` value.

Save and exit (`Ctrl+X`, then `Y`, then `Enter`).

### 6.4 Set Up Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations to create database schema
npx prisma migrate deploy

# (Optional) Seed initial data (admin account, etc.)
npm run seed
```

**Important:** The seed script will create a default admin account. Check `backend/scripts/seed.js` for the default credentials and **change them immediately** after first login.

### 6.5 Create Required Directories

```bash
mkdir -p uploads/logos
mkdir -p uploads/profiles
mkdir -p uploads/sounds
mkdir -p videos
mkdir -p logs
```

### 6.6 Set File Permissions

```bash
chmod 755 uploads videos logs
chmod 644 .env
chmod 644 prisma/dev.db
```

---

## Step 7: Configure PM2

### 7.1 Create PM2 Ecosystem File

```bash
cd ~/queing-backend
nano ecosystem.config.cjs
```

Add the following (adjust paths as needed):

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
      max_memory_restart: "500M",
    },
  ],
};
```

**Replace `/home/username/queing-backend` with your actual backend path.**

Save and exit.

### 7.2 Start the Application with PM2

```bash
cd ~/queing-backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

The `pm2 startup` command will output instructions. Follow them to enable PM2 to start on server reboot. It usually looks like:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username
```

Copy and run the command it provides.

### 7.3 Verify PM2 Status

```bash
pm2 status
pm2 logs queing-backend
```

You should see the backend running. Press `Ctrl+C` to exit logs.

---

## Step 8: Configure Reverse Proxy

Your frontend runs on port 80/443, but the backend runs on port 5002. You need to proxy API requests.

### Option A: Using Nginx (Recommended)

#### 8.1 Install Nginx (if not installed)

```bash
sudo apt-get update
sudo apt-get install nginx -y
```

#### 8.2 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/queing
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend (React app)
    root /home/username/public_html;
    index index.html;

    # API proxy
    location /api {
        proxy_pass http://localhost:5002/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads proxy
    location /uploads {
        proxy_pass http://localhost:5002/uploads;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Videos proxy
    location /videos {
        proxy_pass http://localhost:5002/videos;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # React Router (SPA) - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**Replace:**
- `yourdomain.com` with your actual domain
- `/home/username/public_html` with your actual frontend path

Save and exit.

#### 8.3 Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/queing /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### Option B: Using Apache

#### 8.1 Install Apache (if not installed)

```bash
sudo apt-get install apache2 -y
```

#### 8.2 Enable Required Modules

```bash
sudo a2enmod rewrite
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo systemctl restart apache2
```

#### 8.3 Create `.htaccess` File

```bash
cd ~/public_html
nano .htaccess
```

Add the following:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On

  # Proxy API requests to backend
  RewriteCond %{REQUEST_URI} ^/api/(.*)$
  RewriteRule ^api/(.*)$ http://localhost:5002/api/$1 [P,L]

  # Proxy upload requests
  RewriteCond %{REQUEST_URI} ^/uploads/(.*)$
  RewriteRule ^uploads/(.*)$ http://localhost:5002/uploads/$1 [P,L]

  # Proxy video requests
  RewriteCond %{REQUEST_URI} ^/videos/(.*)$
  RewriteRule ^videos/(.*)$ http://localhost:5002/videos/$1 [P,L]

  # React Router (SPA) - serve index.html for all routes
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Save and exit.

---

## Step 9: Set Up SSL/HTTPS

### Option A: Using Let's Encrypt (Free)

#### 9.1 Install Certbot

```bash
sudo apt-get install certbot python3-certbot-nginx -y
# OR for Apache:
# sudo apt-get install certbot python3-certbot-apache -y
```

#### 9.2 Obtain SSL Certificate

**For Nginx:**
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**For Apache:**
```bash
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will automatically configure SSL and set up auto-renewal.

#### 9.3 Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

### Option B: Using cPanel (if available)

1. Log into cPanel
2. Go to **SSL/TLS Status**
3. Install Let's Encrypt certificate
4. Force HTTPS redirect

---

## Step 10: Configure Firewall (Optional but Recommended)

```bash
# Allow SSH (important - don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 11: Testing

### 11.1 Test Backend API

```bash
curl http://localhost:5002/api/health
# OR
curl https://yourdomain.com/api/health
```

You should get a response.

### 11.2 Test Frontend

Visit `https://yourdomain.com` in your browser. You should see the login page.

### 11.3 Test Admin Login

1. Go to `https://yourdomain.com/admin/login`
2. Use the default admin credentials (from seed script)
3. **Immediately change the password** after first login

### 11.4 Test Staff Login

1. Create a staff account from the admin dashboard
2. Test staff login at `https://yourdomain.com/staff/login`

### 11.5 Test Queue Flow

1. Join queue as a client
2. Assign window as staff
3. Serve client
4. Verify monitoring page updates

---

## Step 12: Post-Deployment Checklist

- [ ] Backend is running: `pm2 status`
- [ ] Frontend loads: Visit `https://yourdomain.com`
- [ ] API works: `curl https://yourdomain.com/api/health`
- [ ] Admin login works
- [ ] Changed default admin password
- [ ] SSL certificate is active (green lock in browser)
- [ ] PM2 auto-start configured: `pm2 startup`
- [ ] Logs are accessible: `pm2 logs queing-backend`
- [ ] File permissions are correct
- [ ] `.env` file is secure (not publicly accessible)

---

## Step 13: Monitoring & Maintenance

### 13.1 Check PM2 Status

```bash
pm2 status
pm2 logs queing-backend --lines 50
```

### 13.2 Set Up Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 13.3 Monitor Disk Space

```bash
df -h
du -sh ~/queing-backend/prisma/dev.db
du -sh ~/queing-backend/uploads
du -sh ~/queing-backend/videos
```

### 13.4 Regular Backups

Create a backup script:

```bash
nano ~/backup-queing.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp ~/queing-backend/prisma/dev.db $BACKUP_DIR/dev_$DATE.db

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz ~/queing-backend/uploads

# Backup videos
tar -czf $BACKUP_DIR/videos_$DATE.tar.gz ~/queing-backend/videos

# Keep only last 7 days
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable:
```bash
chmod +x ~/backup-queing.sh
```

Add to crontab (daily at 2 AM):
```bash
crontab -e
```

Add:
```
0 2 * * * /home/username/backup-queing.sh
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs queing-backend

# Check if port is in use
sudo netstat -tulpn | grep 5002

# Restart backend
pm2 restart queing-backend

# Check Node.js version
node --version  # Should be 18+
```

### Frontend Not Loading

```bash
# Check nginx/Apache status
sudo systemctl status nginx
# OR
sudo systemctl status apache2

# Check nginx/Apache error logs
sudo tail -f /var/log/nginx/error.log
# OR
sudo tail -f /var/log/apache2/error.log

# Verify frontend files exist
ls -la ~/public_html/
```

### API Requests Failing

```bash
# Test backend directly
curl http://localhost:5002/api/health

# Check reverse proxy configuration
sudo nginx -t
# OR check Apache .htaccess syntax

# Check CORS settings in backend/server.js
```

### Database Errors

```bash
# Check database file permissions
ls -la ~/queing-backend/prisma/dev.db

# Verify migrations ran
cd ~/queing-backend
npx prisma migrate status

# Check database path in .env
cat ~/queing-backend/.env | grep DATABASE_URL
```

### PM2 Not Starting on Reboot

```bash
# Re-run startup command
pm2 startup
# Follow the instructions it provides

# Or manually create systemd service
sudo nano /etc/systemd/system/queing-backend.service
```

Add:
```ini
[Unit]
Description=Queuing System Backend
After=network.target

[Service]
Type=simple
User=username
WorkingDirectory=/home/username/queing-backend
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=5002

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable queing-backend
sudo systemctl start queing-backend
```

---

## Quick Update/Deployment Script

Create `~/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "Starting deployment..."

cd ~/queing-backend

# Pull latest code (if using git)
# git pull origin main

# Install dependencies
npm install --production

# Run database migrations
npx prisma generate
npx prisma migrate deploy

# Restart backend
pm2 restart queing-backend

echo "Deployment complete!"
pm2 status
```

Make executable:
```bash
chmod +x ~/deploy.sh
```

Run updates:
```bash
~/deploy.sh
```

---

## Security Recommendations

1. **Change default admin password** immediately after first login
2. **Use strong JWT_SECRET** (generate with `openssl rand -base64 32`)
3. **Keep `.env` file secure** (permissions 644, not publicly accessible)
4. **Enable HTTPS** (SSL certificate)
5. **Set up firewall** (UFW or iptables)
6. **Regular updates**: Keep Node.js, npm, and system packages updated
7. **Monitor logs** regularly for suspicious activity
8. **Backup regularly** (database, uploads, videos)

---

## Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs queing-backend`
2. Check web server logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables: `cat ~/queing-backend/.env`
4. Test API directly: `curl http://localhost:5002/api/health`
5. Check file permissions: `ls -la ~/queing-backend`
6. Review this guide for common issues

---

## Next Steps

After successful deployment:

1. Create your first admin account (or use seeded one)
2. Create staff accounts
3. Set up windows
4. Configure categories and subcategories
5. Upload logo and branding
6. Configure TTS settings (if using)
7. Test the complete queue flow
8. Set up regular backups
9. Monitor system performance

Good luck with your deployment! 🚀
