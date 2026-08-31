# Deploying to Render.com

This guide provides step-by-step instructions to deploy the **API Rate-Limiting & Security Logger** application to [Render](https://render.com/).

---

## 🚀 Quick Deployment Options

You can deploy using either:
- **Option 1: Blueprint Deployment (Recommended & Fastest)** — Automatically configures everything using the repository's `render.yaml`.
- **Option 2: Manual Web Service Setup** — Manually configure through Render's Web UI dashboard.

---

## Option 1: Blueprint Deployment (1-Click Setup)

1. Push your code to your GitHub / GitLab repository (e.g. `https://github.com/harshi2410/seqa`).
2. Log in to your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** at the top right and select **Blueprint**.
4. Connect your GitHub / GitLab repository.
5. Render will automatically detect the [`render.yaml`](./render.yaml) file in the root directory.
6. Click **Apply**.
7. Render will build the service, generate a secure `ADMIN_API_KEY`, inject all environment variables, and start the application.

---

## Option 2: Manual Web Service Setup

If you prefer to configure the service manually on Render:

1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repository (`harshi2410/seqa`).
4. Configure the settings:
   - **Name:** `seqa-security-service` (or your preferred name)
   - **Region:** Choose the region closest to you (e.g., *Oregon (US West)*, *Frankfurt (EU)*, *Singapore (Asia)*)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

5. **Set Environment Variables:**
   Under the **Environment Variables** section, add:

   | Key | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production mode |
   | `TRUST_PROXY` | `true` | **CRITICAL:** Allows real client IP detection behind Render's reverse proxy / load balancer |
   | `ADMIN_API_KEY` | *(Enter a secure secret string or generate one)* | Secret key for dashboard admin actions and protected endpoints |
   | `RATE_LIMIT_WINDOW_MS` | `60000` | Sliding window in milliseconds (1 min) |
   | `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per IP in the window |
   | `VIOLATION_THRESHOLD` | `3` | Number of violations before IP is temporarily blocked |
   | `BLOCK_DURATION_MS` | `300000` | Block duration (5 minutes) |
   | `MAX_REQUEST_LOGS` | `10000` | Max logs retained in FIFO queue |

6. **Health Check Path:**
   - Expand **Advanced Settings**.
   - Set **Health Check Path** to `/health`.

7. Click **Create Web Service**.

---

## 🌐 Verifying Your Live Deployment

Once the build finishes and status turns to **Live**:

- **Web Dashboard:** `https://<your-subdomain>.onrender.com/dashboard`
- **Interactive Sandbox:** `https://<your-subdomain>.onrender.com/dashboard/api-test`
- **Settings & Config:** `https://<your-subdomain>.onrender.com/dashboard/settings`
- **Health Check Endpoint:** `https://<your-subdomain>.onrender.com/health`
- **Protected Admin API:** `https://<your-subdomain>.onrender.com/api/admin/stats` (requires header `x-admin-key: <ADMIN_API_KEY>`)

---

## 🛡️ Critical Render Notes & Best Practices

### 1. Reverse Proxy & Client IP Detection (`TRUST_PROXY=true`)
Render terminates SSL and sits behind a reverse proxy/load balancer. Setting `TRUST_PROXY=true` ensures Express correctly reads client IP addresses from the `X-Forwarded-For` header. This prevents all visitors from being grouped under Render's internal IP for rate limiting.

### 2. Port Binding
Render automatically assigns a dynamic port via `process.env.PORT` (usually `10000`). The application automatically binds to `process.env.PORT` without any manual port configuration required.

### 3. Data Persistence
- On Render's **Free Tier**, the disk filesystem is ephemeral (resets on container redeploys or restarts). Default data files (`security_logs.json`, `ip_blocks.json`, etc.) will auto-initialize in `./data` upon startup.
- If persistent storage across deployments is desired on a paid instance, attach a **Persistent Disk** mounted at `/var/data` and set the environment variable:
  ```env
  DATA_DIR=/var/data
  ```
