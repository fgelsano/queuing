# Deployment Checklist

Use this checklist to ensure a smooth deployment.

## Pre-Deployment

- [ ] Test application locally
- [ ] Build frontend: `cd frontend && npm run build`
- [ ] Test frontend build: `npm run preview`
- [ ] Update all passwords (admin, staff)
- [ ] Generate strong JWT_SECRET
- [ ] Review and update environment variables
- [ ] Backup any existing data

## Server Setup

- [ ] Verify Node.js is installed (version 18+)
- [ ] Verify npm is installed
- [ ] Check available disk space
- [ ] Note your server's Node.js path (may be `/usr/bin/node` or custom)

## File Upload

- [ ] Upload `backend/` folder to server
- [ ] Upload `frontend/dist/` folder contents to `public_html/`
- [ ] Upload root `package.json` (if using workspaces)
- [ ] Verify file permissions (folders: 755, files: 644)

## Backend Configuration

- [ ] Create `backend/.env` file on server
- [ ] Set `DATABASE_URL` in `.env`
- [ ] Set `JWT_SECRET` in `.env` (strong random string)
- [ ] Set `PORT` in `.env` (usually 5002)
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Run `npm install --production` in backend directory
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma migrate deploy`
- [ ] Create `uploads/logos` directory
- [ ] Create `uploads/profiles` directory
- [ ] Create `videos` directory
- [ ] Create `logs` directory

## Process Management

- [ ] Install PM2: `npm install -g pm2`
- [ ] Create `ecosystem.config.js` in backend directory
- [ ] Start application: `pm2 start ecosystem.config.js`
- [ ] Save PM2 configuration: `pm2 save`
- [ ] Set up PM2 startup: `pm2 startup` (follow instructions)
- [ ] Verify app is running: `pm2 status`

## Frontend Configuration

- [ ] Verify `frontend/dist/` files are in `public_html/`
- [ ] Create `.htaccess` file in `public_html/`
- [ ] Configure reverse proxy in `.htaccess`
- [ ] Test React Router (navigate to different pages)

## Domain & SSL

- [ ] Point domain to server (if not already done)
- [ ] Install SSL certificate in cPanel
- [ ] Force HTTPS redirect in `.htaccess`
- [ ] Test HTTPS access

## Testing

- [ ] Visit homepage: `https://yourdomain.com`
- [ ] Test API health: `https://yourdomain.com/api/health`
- [ ] Test admin login
- [ ] Test staff login
- [ ] Test queue creation
- [ ] Test video player (if videos configured)
- [ ] Test file uploads (logo, profile picture)
- [ ] Test all major features

## Security

- [ ] Change default admin password
- [ ] Change default staff passwords
- [ ] Verify `.env` file is not publicly accessible
- [ ] Check file permissions
- [ ] Review CORS settings
- [ ] Enable HTTPS only

## Monitoring

- [ ] Set up PM2 log rotation
- [ ] Check application logs: `pm2 logs queing-backend`
- [ ] Monitor disk space usage
- [ ] Set up backup schedule

## Post-Deployment

- [ ] Document server access details
- [ ] Document database backup procedure
- [ ] Document update/deployment procedure
- [ ] Share access credentials securely
- [ ] Test from different devices/browsers

## Troubleshooting Commands

```bash
# Check if backend is running
pm2 status

# View logs
pm2 logs queing-backend

# Restart backend
pm2 restart queing-backend

# Check Node.js version
node --version

# Check port usage
netstat -tulpn | grep 5002

# Check disk space
df -h

# Check file permissions
ls -la backend/
```
