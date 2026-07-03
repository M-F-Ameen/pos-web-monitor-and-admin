# Deployment Guide

This guide explains how to deploy the POS Monitor Dashboard to production environments.

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All TypeScript errors resolved: `npx tsc --noEmit`
- [ ] Production build succeeds: `npm run build`
- [ ] Environment variables configured in `.env.local`
- [ ] Backend API endpoints are ready
- [ ] CORS is enabled on backend (if different domain)
- [ ] Database migrations are complete
- [ ] SSL/TLS certificate prepared (for HTTPS)

## Build Process

### Local Build Test

```bash
# Build for production
npm run build

# Verify build output
ls -la .next/

# Test production server locally
npm start
# Open http://localhost:3000
```

### Build Output Structure

```
.next/
├── .build-manifest          # Internal Next.js manifest
├── build-id                 # Build identifier
├── cache/                   # Build cache
├── server/                  # Node.js server code
├── static/                  # Static assets (CSS, JS)
├── standalone/              # Standalone deployment option
└── public/                  # Public assets
```

## Environment Variables

Create `.env.production` for production settings:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api

# Internationalization
NEXT_PUBLIC_LOCALE=ar
NEXT_PUBLIC_RTL=true

# Feature Flags
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id

# Security
# (Don't commit actual secrets to git)
# Use your platform's secret management
```

**Important:** Never commit `.env.local` or `.env.production.local` to git. Use environment variables provided by your hosting platform.

## Deployment Options

### Option 1: Vercel (Recommended)

**Why Vercel?**
- Made by Next.js creators
- Automatic deployments
- Serverless functions
- CDN included
- One-click rollback

**Steps:**

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js

3. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add `NEXT_PUBLIC_API_BASE_URL`
   - Select which environments (development, preview, production)

4. **Deploy**
   - Vercel automatically deploys on push to `main`
   - View logs: Project → Deployments

**Advantages:**
- ✅ Automatic HTTPS
- ✅ Edge functions
- ✅ Automatic optimizations
- ✅ 99.9% uptime SLA

### Option 2: Netlify

**Steps:**

1. **Build configuration**
   - Create `netlify.toml`:
   ```toml
   [build]
   command = "npm run build"
   publish = ".next"
   
   [[redirects]]
   from = "/*"
   to = "/index.html"
   status = 200
   ```

2. **Connect to Netlify**
   - Visit [netlify.com](https://netlify.com)
   - Connect your GitHub account
   - Select repository
   - Set build command: `npm run build`
   - Set publish directory: `.next`

3. **Set environment variables**
   - Site settings → Build & deploy → Environment
   - Add `NEXT_PUBLIC_API_BASE_URL`

4. **Deploy**
   - Netlify auto-deploys on push to main branch

**Advantages:**
- ✅ Free tier available
- ✅ Good performance
- ✅ Simple setup

### Option 3: Self-Hosted (Node.js)

**Requirements:**
- Node.js 18.17+
- npm or yarn
- Reverse proxy (nginx, Apache)
- SSL certificate (Let's Encrypt)

**Setup:**

1. **Build on server**
   ```bash
   # SSH into your server
   ssh user@your-server.com
   
   # Clone repository
   git clone https://github.com/yourusername/pos-dashboard.git
   cd pos-dashboard
   
   # Install dependencies
   npm install
   
   # Create .env.production.local
   cat > .env.production.local << EOF
   NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api
   EOF
   
   # Build
   npm run build
   ```

2. **Run production server**
   ```bash
   # Option A: Direct (development)
   npm start
   
   # Option B: With PM2 (production)
   npm install -g pm2
   pm2 start npm --name "pos-dashboard" -- start
   pm2 startup
   pm2 save
   ```

3. **Setup Nginx reverse proxy**
   ```nginx
   # /etc/nginx/sites-available/pos-dashboard
   
   server {
       listen 80;
       server_name your-domain.com;
   
       # Redirect HTTP to HTTPS
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl http2;
       server_name your-domain.com;
   
       # SSL Certificate (Let's Encrypt)
       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
   
       # Compression
       gzip on;
       gzip_types text/plain text/css application/json application/javascript;
   
       # Reverse proxy to Node.js
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   
       # Cache static assets
       location /_next/static {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

4. **Enable SSL with Let's Encrypt**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot certonly --nginx -d your-domain.com
   ```

5. **Test and restart Nginx**
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

**Advantages:**
- ✅ Full control
- ✅ Lower costs at scale
- ✅ No vendor lock-in

### Option 4: Docker

**Dockerfile:**

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
```

**Build and run:**

```bash
# Build image
docker build -t pos-dashboard:latest .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api \
  pos-dashboard:latest
```

**Docker Compose:**

```yaml
version: '3.8'

services:
  dashboard:
    build: .
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_BASE_URL: https://api.your-domain.com/api
      NODE_ENV: production
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - dashboard
    restart: unless-stopped
```

### Option 5: AWS (ECS/Fargate)

**Steps:**

1. **Create ECR repository**
   ```bash
   aws ecr create-repository --repository-name pos-dashboard
   ```

2. **Build and push image**
   ```bash
   # Get login token
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [account-id].dkr.ecr.us-east-1.amazonaws.com
   
   # Build image
   docker build -t pos-dashboard:latest .
   
   # Tag image
   docker tag pos-dashboard:latest [account-id].dkr.ecr.us-east-1.amazonaws.com/pos-dashboard:latest
   
   # Push image
   docker push [account-id].dkr.ecr.us-east-1.amazonaws.com/pos-dashboard:latest
   ```

3. **Create Fargate task**
   - Go to ECS → Create service
   - Select Fargate launch type
   - Configure container (ECR image URL)
   - Set environment variables
   - Configure load balancer (ALB)

4. **Setup CloudFront (CDN)**
   - Create CloudFront distribution
   - Point to ALB origin
   - Enable caching for static assets

## Performance Optimization

### 1. Enable Compression

Nginx:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1024;
```

### 2. Set Cache Headers

```nginx
# Cache static assets forever
location /_next/static {
    expires 365d;
    add_header Cache-Control "public, immutable";
}

# Cache public assets for 1 day
location /public {
    expires 1d;
    add_header Cache-Control "public";
}

# Don't cache HTML pages
location = / {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### 3. Enable CDN

Use CloudFlare, AWS CloudFront, or similar for:
- Global distribution
- DDoS protection
- Automatic compression
- Caching at edge

### 4. Image Optimization

Next.js Image component automatically:
- ✅ Serves AVIF on modern browsers
- ✅ Serves WebP on supported browsers
- ✅ Resizes images for device size
- ✅ Lazy loads below fold

## Monitoring

### 1. Application Monitoring

```bash
# Install PM2
npm install -g pm2

# Setup monitoring
pm2 start npm --name "pos-dashboard" -- start
pm2 monit
```

### 2. Error Tracking

Add Sentry:

```typescript
// src/lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### 3. Analytics

Add Google Analytics or Vercel Analytics:

```typescript
// src/app/layout.tsx
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout() {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## Security Checklist

### Before Going Live

- [ ] **HTTPS/SSL enabled** - Use Let's Encrypt (free)
- [ ] **Security headers set**
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header X-XSS-Protection "1; mode=block";
  add_header Referrer-Policy "strict-origin-when-cross-origin";
  add_header Content-Security-Policy "default-src 'self'";
  ```
- [ ] **Secrets in env vars** - Never in code
- [ ] **API validation** - Check response types
- [ ] **CORS configured** - Restrict to known origins
- [ ] **Rate limiting** - Prevent abuse
- [ ] **Input validation** - Use Zod schemas
- [ ] **Regular updates** - npm audit, security patches

## Deployment Checklist

**Before Deploying:**
```bash
# Run checks
npm run build        # Verify build succeeds
npx tsc --noEmit    # Check TypeScript
npm run lint        # Run linter

# Run tests (if added)
npm test
```

**After Deploying:**
- [ ] Test all pages load
- [ ] Test all filters/search work
- [ ] Test responsive on mobile
- [ ] Check Console for errors
- [ ] Monitor error tracking
- [ ] Review analytics

## Rollback Procedure

**Vercel:**
- Go to Deployments
- Click three dots on previous deployment
- Select "Promote to Production"

**Self-hosted:**
```bash
# Revert to previous version
git checkout previous-commit-hash
npm run build
pm2 restart pos-dashboard
```

**Docker:**
```bash
docker run -p 3000:3000 pos-dashboard:previous-tag
```

## Cost Comparison

| Platform | Monthly Cost | Includes |
|----------|------------|----------|
| **Vercel Free** | $0 | 100 deploys/month, 100 GB bandwidth |
| **Vercel Pro** | $20 | Unlimited deployments, 1TB bandwidth |
| **Netlify Free** | $0 | 300 build minutes/month |
| **AWS Fargate** | $50-200 | 24/7 uptime, auto-scaling |
| **Self-hosted** | $10-50 | Full control, VPS required |

## Need Help?

- **Vercel Issues:** https://vercel.com/support
- **Netlify Issues:** https://docs.netlify.com
- **AWS Issues:** https://aws.amazon.com/support
- **Next.js Issues:** https://github.com/vercel/next.js/issues

---

Good luck with your deployment! 🚀
