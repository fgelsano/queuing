#!/bin/bash

# Deployment Script for Queuing System
# Run this script on your server after uploading files

echo "🚀 Starting deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "backend/server.js" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Step 1: Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd backend
npm install --production

# Step 2: Generate Prisma client
echo -e "${YELLOW}🔧 Generating Prisma client...${NC}"
npx prisma generate

# Step 3: Run migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
npx prisma migrate deploy

# Step 4: Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p uploads/logos
mkdir -p uploads/profiles
mkdir -p videos
mkdir -p logs

# Step 5: Set permissions
echo -e "${YELLOW}🔐 Setting file permissions...${NC}"
chmod 755 uploads videos logs
chmod 644 .env 2>/dev/null || echo "Note: .env file not found, create it manually"

# Step 6: Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
fi

# Step 7: Restart application with PM2
echo -e "${YELLOW}🔄 Restarting application...${NC}"
if pm2 list | grep -q "queing-backend"; then
    pm2 restart queing-backend
else
    pm2 start ecosystem.config.cjs || pm2 start server.js --name queing-backend
    pm2 save
fi

# Step 8: Show status
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Application status:"
pm2 status

echo ""
echo -e "${GREEN}📋 Next steps:${NC}"
echo "1. Verify .env file is configured correctly"
echo "2. Check logs: pm2 logs queing-backend"
echo "3. Test the application in your browser"
echo "4. Set up SSL certificate in cPanel"
