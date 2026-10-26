# ALEX AI-Powered ERP — Deployment Guide

**Target Architecture:**
```
GitHub Repository
       |
       +------------------------------+
       |                              |
       v                              v
Cloudflare Worker (Proxy)         Render Web Service (Docker)
                                     (Next.js API + SSR + Worker)
                                          |
                                          v
                                  Neon PostgreSQL (pgvector)
```

---

## Prerequisites

- GitHub repository with the ALEX codebase
- Render account (for Web Service + Background Worker)
- Neon account (for PostgreSQL with pgvector)
- Cloudflare account (for Worker proxy)
- Cloudflare R2 or S3-compatible storage (for file uploads)
- AI provider API keys (NVIDIA Nemotron, OpenAI, etc.)

---

## 1. Provision Neon PostgreSQL Database

### 1.1 Create Neon Project

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project named `alex-erp`
3. Select PostgreSQL 16, region closest to your Render region (e.g., `us-east-1` for Oregon)
4. Enable **pgvector** extension (required for embeddings)

### 1.2 Get Connection Strings

From Neon dashboard, copy:

- **Pooled connection** (for application): `DATABASE_URL`
  - Format: `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/alex?sslmode=require`
- **Direct connection** (for migrations): `DIRECT_URL`
  - Format: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/alex?sslmode=require`

### 1.3 Run Initial Migration

```bash
# Locally, with DIRECT_URL set:
export DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/alex?sslmode=require"
cd apps/web
pnpm run db:migrate:deploy
```

---

## 2. Configure Cloudflare R2 (or S3-compatible Storage)

### 2.1 Create R2 Bucket

1. Go to Cloudflare Dashboard → R2
2. Create bucket named `alex-bucket`
3. Create API token with R2 read/write permissions

### 2.2 Note Storage Credentials

- `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`
- `S3_ACCESS_KEY_ID`: From R2 API token
- `S3_SECRET_ACCESS_KEY`: From R2 API token
- `S3_BUCKET`: `alex-bucket`
- `S3_REGION`: `auto`

---

## 3. Configure Render Web Service

### 3.1 Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. New → Web Service → Connect your GitHub repository
3. Settings:
   - **Name**: `alex-web`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Build Context**: `.`
   - **Docker Build Target**: `runner-api`
   - **Plan**: Standard (or higher)
   - **Region**: Same as Neon (e.g., Oregon)
   - **Health Check Path**: `/api/health`

### 3.2 Create Background Worker

1. New → Background Worker → Connect same repository
2. Settings:
   - **Name**: `alex-worker`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Build Context**: `.`
   - **Docker Build Target**: `runner-worker`
   - **Plan**: Starter
   - **Region**: Same as web service

### 3.3 Set Environment Variables

**For BOTH services (web + worker):**

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Web service only |
| `HOSTNAME` | `0.0.0.0` | |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.onrender.com` | Your Render service URL |
| `NEXTAUTH_URL` | `https://your-app.onrender.com` | Must match above |
| `AUTH_MODE` | `local` | |
| `NEXT_PUBLIC_AUTH_MODE` | `local` | |
| `AUTH_SECRET` | `openssl rand -base64 32` | **Keep stable!** |
| `DATABASE_URL` | Neon pooled connection | From step 1.2 |
| `DIRECT_URL` | Neon direct connection | From step 1.2 |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | **Keep stable!** |
| `AI_MODE` | `nemotron` | Or your provider |
| `NVIDIA_NEMOTRON_API_KEY` | Your NVIDIA key | If using Nemotron |
| `STORAGE_MODE` | `s3` | |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | |
| `S3_REGION` | `auto` | |
| `S3_ACCESS_KEY_ID` | R2 access key | |
| `S3_SECRET_ACCESS_KEY` | R2 secret key | |
| `S3_BUCKET` | `alex-bucket` | |
| `STORAGE_BUCKET_DOCUMENTS` | `documents` | |
| `STORAGE_BUCKET_AVATARS` | `avatars` | |
| `STORAGE_BUCKET_RESOURCES` | `resources` | |
| `MAX_FILE_SIZE_MB` | `50` | |
| `ALLOWED_FILE_TYPES` | `pdf,doc,docx,txt,md,csv,xls,xlsx,ppt,pptx,png,jpg,jpeg` | |

**Optional (if using):**
- Dropbox: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`

---

## 4. Configure Dropbox OAuth (Optional)

### 4.1 Create Dropbox App

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Create app: "Scoped access" → "Full Dropbox"
3. App name: `ALEX ERP`
4. Redirect URI: `https://your-app.onrender.com/api/storage/dropbox/callback`

### 4.2 Configure in Render

Set these environment variables on **web service only**:
- `DROPBOX_APP_KEY`
- `DROPBOX_APP_SECRET`
- `DROPBOX_REDIRECT_URI` = `https://your-app.onrender.com/api/storage/dropbox/callback`

---

## 5. Configure Cloudflare Worker (Proxy)

### 5.1 Create Worker

1. Go to Cloudflare Dashboard → Workers & Pages
2. Create Worker → Deploy via Wrangler or dashboard

### 5.2 Configure Worker

**wrangler.toml:**
```toml
name = "alex-ai-powered-erp"
main = "worker.js"
compatibility_date = "2026-10-21"
compatibility_flags = ["nodejs_compat"]

[vars]
RENDER_API_URL = "https://alex-web.onrender.com"  # Your Render web service URL
```

### 5.3 Set Worker Secret

```bash
wrangler secret put RENDER_API_URL
# Enter: https://alex-web.onrender.com
```

### 5.4 Deploy Worker

```bash
cd cloudflare-worker
pnpm install
pnpm run deploy
```

### 5.5 Add Custom Domain (Optional)

1. Workers → your-worker → Triggers → Add Custom Domain
2. Set domain: `api.yourdomain.com`
3. Update `RENDER_API_URL` if needed

---

## 6. GitHub Actions CI/CD

### 6.1 Add Repository Secrets

Go to GitHub Repository → Settings → Secrets and variables → Actions

| Secret | Description |
|--------|-------------|
| `RENDER_API_KEY` | From Render Account Settings → API Keys |
| `RENDER_SERVICE_ID` | From Render service URL: `srv-xxxxxxxx` |
| `NEON_DIRECT_URL` | Neon direct connection string |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (Workers scripts:Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | From Cloudflare dashboard |

### 6.2 Enable Workflow

The workflow at `.github/workflows/render-deploy.yml` will:
1. Run lint, typecheck, tests on every push
2. Build Docker images for API and Worker
3. Deploy to Render on main branch push
4. Run Prisma migrations via Render
5. Deploy Cloudflare Worker

---

## 7. Local Docker Validation

### 7.1 Build Image

```bash
# From repository root
docker build --target runner-api -t alex-web:local .
docker build --target runner-worker -t alex-worker:local .
```

### 7.2 Test API Container

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="test-secret" \
  -e ENCRYPTION_KEY="test-key" \
  -e AI_MODE=mock \
  alex-web:local
```

### 7.3 Verify Health

```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 7.4 Test Worker Container

```bash
docker run --rm \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="test-secret" \
  -e ENCRYPTION_KEY="test-key" \
  -e AI_MODE=mock \
  alex-worker:local
```

---

## 8. Post-Deployment Verification

### 8.1 Health Checks

```bash
# Render web service
curl https://alex-web.onrender.com/api/health

# Cloudflare worker
curl https://your-worker.your-subdomain.workers.dev/health
# or custom domain
curl https://api.yourdomain.com/health
```

### 8.2 Functional Tests

1. **Authentication**: Register/login at `https://your-app.onrender.com`
2. **Document Upload**: Upload a PDF → verify extraction & chunks
3. **AI Chat**: Ask a question → verify RAG response with citations
4. **Study Studio**: Generate flashcards from uploaded doc
5. **Research Lab**: Create notebook, add sources, query
6. **Dropbox**: Connect account, browse files, import
7. **File Download**: Download uploaded/generated documents

### 8.3 Check Logs

- Render Dashboard → Service → Logs
- Cloudflare Workers → Logs
- Neon Dashboard → Query performance

---

## 9. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `ENCRYPTION_KEY` mismatch | Ensure same key used across deployments; re-encrypt if rotated |
| Prisma migration fails | Use `DIRECT_URL` for migrations; check Neon connection limits |
| File uploads fail | Verify `STORAGE_MODE=s3` and R2 credentials; check CORS on bucket |
| Dropbox callback fails | Ensure `DROPBOX_REDIRECT_URI` matches exactly in Dropbox app |
| Worker 502 errors | Check `RENDER_API_URL` is correct; verify Render service is healthy |
| OCR not working | Ensure `tesseract-ocr` installed in Docker (added in Dockerfile) |
| WebSocket issues | Cloudflare Worker doesn't proxy WebSockets by default |

### Debug Commands

```bash
# Check Render service logs
render logs srv-xxxxxxxx --tail 100

# Check Neon connections
neonctl connection-pool list

# Test database connection locally
psql "$DATABASE_URL" -c "SELECT 1;"

# Verify Prisma client
cd apps/web && pnpm run db:generate
```

---

## 10. Maintenance

### Database Migrations

```bash
# Local development
cd apps/web
pnpm run db:migrate dev

# Production (via Render shell or CI)
cd apps/web
pnpm run db:migrate:deploy
```

### Secret Rotation

1. Generate new secrets
2. Update in Render dashboard
3. Update in Cloudflare Worker secrets
4. Redeploy both services
5. **For ENCRYPTION_KEY**: Re-encrypt all stored credentials first!

### Scaling

- **Render Web**: Increase plan or add instances
- **Render Worker**: Increase plan or add instances
- **Neon**: Auto-scales; monitor connection pool usage
- **R2**: No scaling needed; pay per request/storage

---

## Security Checklist

- [ ] All secrets in Render/Cloudflare, not in code
- [ ] `ENCRYPTION_KEY` and `AUTH_SECRET` are stable across deployments
- [ ] `DATABASE_URL` uses Neon pooled connection with SSL
- [ ] `DIRECT_URL` only used for migrations
- [ ] CORS configured correctly in Cloudflare Worker
- [ ] Dropbox OAuth uses HTTPS callback URL
- [ ] R2 bucket has no public access
- [ ] Render health check doesn't expose sensitive info
- [ ] GitHub Actions secrets used for all credentials
- [ ] No `.env` files committed to repository

---

## Support Resources

- [Render Documentation](https://render.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Prisma with Neon](https://www.prisma.io/docs/guides/database/neon)
- [Next.js on Docker](https://nextjs.org/docs/app/building-your-application/deploying/docker)