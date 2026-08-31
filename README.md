# API Rate-Limiting & Middleware Security Logger

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19+-blue.svg)](https://expressjs.com/)
[![Tests](https://img.shields.io/badge/Jest-Passing-brightgreen.svg)](https://jestjs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, educational **Express.js Middleware Security Service** designed for college Technical Assessment and Examination (TAE). The system monitors incoming API traffic, enforces configurable client rate limits, logs security violations to an atomic JSON file database, automatically blocks abusive IP addresses upon exceeding threshold limits, and provides an interactive cybersecurity monitoring dashboard and testing sandbox.

---

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Objectives](#objectives)
3. [Key Features](#key-features)
4. [Technology Stack](#technology-stack)
5. [System & Middleware Architecture](#system--middleware-architecture)
6. [Rate-Limiting & IP Blocking Workflow](#rate-limiting--ip-blocking-workflow)
7. [Installation & Setup](#installation--setup)
8. [Running the Application](#running-the-application)
9. [Deploying to Render](#deploying-to-render)
10. [Running Automated Tests](#running-automated-tests)
11. [API Reference Documentation](#api-reference-documentation)
12. [JSON File Database Architecture](#json-file-database-architecture)
13. [Cybersecurity Dashboard & Sandbox](#cybersecurity-dashboard--sandbox)
14. [TAE Viva Demonstration Guide](#tae-viva-demonstration-guide)
15. [Security Considerations & Limitations](#security-considerations--limitations)
16. [Future Scope](#future-scope)
17. [Comprehensive Viva Questions & Answers](#comprehensive-viva-questions--answers)

---

## Problem Statement

Web APIs and microservices are frequently subjected to brute-force credential stuffing, API scraping, excessive polling, and Denial of Service (DoS) attempts. Without protection:
- Server resources (CPU, Memory, Database connections) are exhausted by aggressive clients.
- Legitimate users experience degraded performance or service outages.
- API abuse remains undetected without structured security telemetry and violation tracking.

This project demonstrates how to build an application-level security layer directly within the Express.js middleware pipeline to detect, throttle, block, and audit abusive client traffic safely and reactively.

---

## Objectives

- **Client Request Tracking:** Intercept API requests to measure latency, detect client IP safely, and track request volumes.
- **Sliding-Window Rate Limiting:** Enforce dynamic request limits per IP over configurable time windows, setting RFC-compliant `X-RateLimit-*` and `Retry-After` headers.
- **Violation Logging:** Persist rate-limit breach incidents (`RATE_LIMIT_VIOLATION`) with detailed request metadata.
- **Automated IP Blocking:** Automatically transition persistent violators to a temporary `403 IP_BLOCKED` blacklist when violation thresholds are breached.
- **JSON File Persistence:** Implement a lightweight, concurrency-safe JSON database with atomic writes, write queues, log rotation, and corruption recovery.
- **Visual Cybersecurity Monitoring:** Provide a real-time dark-theme dashboard with Chart.js telemetry, searchable log streams, and one-click administrator IP unblocking.

---

## Key Features

- 🛡️ **Modular Middleware Pipeline:** Separate concerns for Security Headers, Request Logging, IP Blacklisting, Rate Limiting, and Error Handling.
- ⏱️ **Configurable Rate Limits:** Dynamic window size, request quota, violation thresholds, and block durations.
- 🚫 **Auto-Expiring IP Blocks:** Temporary blocklists automatically expire after duration elapsed or through administrative override.
- 🗄️ **Safe JSON Persistence:** Prevents race conditions using promise queues and avoids corrupted writes using atomic temp file swaps.
- 🔄 **Log Rotation (FIFO):** Bounds log growth to the latest 10,000 records while preserving critical security events.
- 📊 **Interactive Cybersecurity Dashboard:** Real-time metrics, 24-hour traffic charts, event doughnut graphs, and top violator rankings.
- 🧪 **TAE Demonstration Sandbox:** Step-by-step interactive test console to trigger 200 OK, 429 Rate Limit, and 403 IP Block live during viva.
- 🔑 **Admin Key Authentication:** Restricts security statistics, log inspection, and unblock actions behind `X-Admin-Key` verification.

---

## Technology Stack

| Layer | Technologies Used |
|---|---|
| **Runtime & Backend** | Node.js (v18+), Express.js (v4.19) |
| **Language** | Modern JavaScript (CommonJS, `async/await`, `const`/`let`) |
| **Security Headers** | Helmet (v7.1) |
| **Database** | JSON File-based Store (`services/jsonDatabase.js`) |
| **Frontend UI** | HTML5, CSS3 (Vanilla Dark Cyber Theme), Bootstrap 5 |
| **Visualizations** | Chart.js (v4.4) |
| **Testing Suite** | Jest (v29.7), Supertest (v7.0) |

---

## System & Middleware Architecture

Incoming requests traverse an ordered security pipeline before reaching business route handlers:

```text
Client Request
      │
      ▼
┌───────────────────────────────────────────────────────────┐
│ 1. Security Headers (Helmet, CSP, Frameguard, NoSniff)    │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│ 2. Request Logger & Telemetry Interceptor (IP, Timer)     │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│ 3. IP Blacklist Checker (services/blockService.js)        │
│    Is IP Active on Blocklist?                             │
│    ├─► YES: Return 403 Forbidden ("IP_BLOCKED")           │
│    └─► NO: Continue Pipeline                              │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│ 4. Rate Limiter (services/rateLimitService.js)            │
│    Set X-RateLimit-Limit, Remaining, Reset Headers        │
│    Has IP Exceeded Max Requests in Window?                │
│    ├─► NO: Allow Request -> Forward to API Route Handlers │
│    └─► YES:                                               │
│         ├─► Record RATE_LIMIT_VIOLATION Log               │
│         ├─► Increment IP Violation Counter                │
│         ├─► Violations >= Threshold?                      │
│         │     ├─► YES: Add IP to Blocklist -> Return 403  │
│         │     └─► NO:  Return 429 Too Many Requests       │
└───────────────────────────────────────────────────────────┘
```

---

## Rate-Limiting & IP Blocking Workflow

1. **Quota Tracking:** Each IP receives a quota (e.g., 100 requests per 60 seconds).
2. **Quota Depletion:** As requests arrive, `X-RateLimit-Remaining` decrements.
3. **Limit Exceeded:** Request #101 receives `HTTP 429 Too Many Requests`, a `Retry-After` header, and a `RATE_LIMIT_VIOLATION` event is logged.
4. **Violation Threshold:** If the same IP violates the rate limit 3 times (configurable `VIOLATION_THRESHOLD`), the IP is immediately blocked for 5 minutes (`BLOCK_DURATION_MS`).
5. **Enforcement:** Subsequent requests from the blocked IP return `HTTP 403 Forbidden`.
6. **Restoration:** Once the timer expires (or an administrator unblocks the IP via the dashboard), full access is restored.

---

## Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Steps

1. **Clone or Navigate to the Project Directory:**
   ```bash
   cd api-rate-security
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   A default `.env` file is included. You can customize `.env` using `.env.example`:
   ```bash
   PORT=3000
   NODE_ENV=development
   ADMIN_API_KEY=admin-secret-key-2026
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX_REQUESTS=100
   VIOLATION_THRESHOLD=3
   BLOCK_DURATION_MS=300000
   TRUST_PROXY=false
   MAX_REQUEST_LOGS=10000
   ```

---

## Running the Application

Start the application using:

```bash
npm start
```

Once started, access:
- **Cybersecurity Monitor Dashboard:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Interactive TAE Test Sandbox:** [http://localhost:3000/dashboard/api-test](http://localhost:3000/dashboard/api-test)
- **Security Policy Settings:** [http://localhost:3000/dashboard/settings](http://localhost:3000/dashboard/settings)
- **Health Check Endpoint:** [http://localhost:3000/health](http://localhost:3000/health)

---

## Deploying to Render

This project is pre-configured for instant deployment on [Render](https://render.com/) with automated Blueprint support (`render.yaml`).

### Quick 1-Click Deploy via Render Blueprint

1. Push your repository to GitHub / GitLab.
2. Open the [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Blueprint**.
3. Connect your repository (`harshi2410/seqa`).
4. Click **Apply**. Render will automatically detect [`render.yaml`](./render.yaml), configure environment variables, generate an `ADMIN_API_KEY`, and deploy the service.

### Manual Web Service Configuration on Render

If configuring manually via Render's Web Service UI:
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`
- **Key Environment Variables:**
  - `NODE_ENV`: `production`
  - `TRUST_PROXY`: `true` *(Enables real client IP detection behind Render's reverse proxy)*
  - `ADMIN_API_KEY`: `<your-admin-secret-key>`
  - `RATE_LIMIT_MAX_REQUESTS`: `100`
  - `RATE_LIMIT_WINDOW_MS`: `60000`

> 📖 For full detailed deployment steps and persistence guidance, see the [Render Deployment Guide (RENDER_DEPLOYMENT.md)](./RENDER_DEPLOYMENT.md).

---

## Running Automated Tests

Run the complete test suite (Jest + Supertest) covering rate limiting, IP blocking, admin authentication, JSON database operations, and API routing:

```bash
npm test
```

---

## API Reference Documentation

### 1. Public & Demonstration Endpoints

#### `GET /health`
Returns service availability status.
```json
{
  "status": "ok",
  "service": "API Rate-Limiting & Middleware Security Logger",
  "version": "1.0.0",
  "timestamp": "2026-09-01T10:00:00.000Z"
}
```

#### `GET /api/test`
Primary test endpoint passing through rate limiting and security loggers.
- **Response Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "API request successful",
  "clientIp": "127.0.0.1",
  "timestamp": "2026-09-01T10:00:00.000Z"
}
```
- **Rate Limited Response (429 Too Many Requests):**
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "limit": 100,
  "retryAfter": 45,
  "violations": 1,
  "threshold": 3
}
```
- **Blocked Response (403 Forbidden):**
```json
{
  "success": false,
  "error": "IP_BLOCKED",
  "message": "Your IP address has been temporarily blocked due to repeated rate-limit violations.",
  "ip": "127.0.0.1",
  "blockedUntil": "2026-09-01T10:05:00.000Z",
  "reason": "Exceeded violation threshold of 3 within the monitoring window"
}
```

#### `GET /api/data`
Returns simulated threat intelligence records.

#### `GET /api/slow?delay=500`
Simulates a delayed backend response (useful for testing latency logging).

---

### 2. Protected Administrator Endpoints
*All Admin endpoints require the `X-Admin-Key` header.*

#### `GET /api/admin/stats`
Returns aggregated dashboard metrics, top violators, targeted endpoints, and Chart.js datasets.

#### `GET /api/admin/logs`
Query security event logs with pagination and filtering.
- **Query Parameters:** `type` (`REQUEST`, `RATE_LIMIT_VIOLATION`, `IP_BLOCKED`, `IP_UNBLOCKED`), `ip`, `limit`, `offset`, `search`.

#### `GET /api/admin/blocks`
Lists currently blocked IP addresses and historical blocks with active/expired statuses.

#### `POST /api/admin/unblock`
Manually restores access to a blocked IP address and records an `IP_UNBLOCKED` audit log.
- **Request Body:**
```json
{
  "ip": "127.0.0.1",
  "reason": "Administrator manual clearance"
}
```

#### `GET /api/admin/config` & `PUT /api/admin/config`
Inspect or update runtime rate limiting thresholds dynamically without server reboot.

---

## JSON File Database Architecture

All persistent data resides in `data/`:
```text
data/
├── config.json          # Persisted dynamic configuration overrides
├── security_logs.json   # Security events and audit trail
├── ip_blocks.json       # Active and historical IP block records
└── request_stats.json   # Aggregated traffic counters
```

### Safety & Concurrency Guarantees
1. **Promise Write Queuing:** Concurrent writes to the same JSON file are serialized per file path to prevent race conditions.
2. **Atomic Temp File Swapping:** Files are written to a temporary unique file (`*.tmp`) and renamed atomically (`fs.rename`).
3. **Corruption Recovery:** If a file becomes corrupted, the system backs it up to `*.corrupt_<timestamp>.bak` and initializes safe defaults rather than crashing the process.
4. **Log Rotation:** Request logs are bounded to the latest 10,000 records using a FIFO queue.

---

## Cybersecurity Dashboard & Sandbox

### 1. Monitoring Dashboard (`/dashboard`)
- **Metric Cards:** Real-time counters for Total Requests, Violations, Active Blocked IPs, and Historical Blocks.
- **Activity Timeline Chart:** Visualizes request rates vs rate-limit violations across a 24-hour window.
- **Threat Breakdown Chart:** Doughnut visualization of normal requests vs violations vs blocks.
- **Blocked IPs Table:** Shows active blocks with real-time countdown timers and one-click **Unblock** buttons.
- **Searchable Event Log Stream:** Filterable table with full payload inspection modal.

### 2. Interactive Sandbox (`/dashboard/api-test`)
- Send single requests or 10-request bursts.
- **"Simulate Flood Attack"** button: Safely sends bounded request bursts to demonstrate 429 rate-limiting and 403 automatic IP blocking.
- Live progress bar showing real-time quota remaining.

---

## TAE Viva Demonstration Guide

Follow this 8-step walkthrough during your project examination:

```text
Step 1: Open http://localhost:3000/dashboard in one browser tab.
Step 2: Open http://localhost:3000/dashboard/api-test in a second tab.
Step 3: Click "Send 1 Request" → Observe 200 OK and X-RateLimit-Remaining decreasing.
Step 4: Click "Send 10 Requests Burst" → Observe rapid quota depletion.
Step 5: Click "Simulate Flood Attack" → Quota reaches 0 → Generates HTTP 429 (Too Many Requests).
Step 6: Continue sending requests to exceed threshold (3 violations) → IP is automatically BLOCKED with HTTP 403 Forbidden.
Step 7: Switch to the Dashboard tab → Observe the live metric cards update, violation chart rise, and IP appear in the "Currently Blocked IPs" table.
Step 8: Click "Unblock" in the Dashboard or "Unblock My IP" in the Sandbox → Send request again → 200 OK restored!
```

---

## Security Considerations & Limitations

### Security Protections Implemented
- **Safe IP Extraction:** Does not blindly trust `X-Forwarded-For` unless `TRUST_PROXY=true`. Normalizes IPv6 loopbacks (`::1` to `127.0.0.1`).
- **Data Sanitization:** Avoids logging authorization headers, passwords, cookies, or sensitive tokens.
- **Strict Input Validation:** Configuration inputs reject negative numbers, `NaN`, `Infinity`, or out-of-range thresholds.
- **Admin Authentication:** Administrative actions require secret key validation (`X-Admin-Key`).

### Educational Limitations (TAE Context)
- **Single-Node In-Memory Tracking:** In multi-server or clustered environments, a distributed datastore such as **Redis** or a Token Bucket algorithm in Memcached would be required for shared rate-limiting state.
- **JSON Storage Scalability:** File-based JSON persistence is ideal for demonstration and low traffic, but production architectures should use relational databases (PostgreSQL) or document stores (MongoDB) with indexing.

---

## Future Scope

- **Distributed Rate Limiting:** Implement Redis-backed sliding-window counter or Leaky Bucket algorithm.
- **Geo-IP Blocking:** Integrate MaxMind GeoLite2 to block or throttle requests by geographic origin.
- **JWT & Role-Based Authentication:** Support OAuth2/JWT for granular per-user rate limiting rather than purely per-IP.
- **SIEM Export:** Stream structured logs to Elasticsearch, Splunk, or Datadog for automated threat analysis.

---

## Comprehensive Viva Questions & Answers

### Q1: What is rate limiting and why is it essential for API security?
> **Answer:** Rate limiting is a defense mechanism that controls the rate of incoming requests a client can make to an API within a defined timeframe. It prevents resource exhaustion, mitigates brute-force and credential stuffing attacks, protects against Denial of Service (DoS), and prevents aggressive web scraping.

### Q2: What is the difference between Fixed Window and Sliding Window algorithms?
> **Answer:**
> - **Fixed Window:** Divides time into fixed intervals (e.g., 12:00 to 12:01). It can suffer from "bursting" at window boundaries (e.g., 100 requests at 12:00:59 and 100 requests at 12:01:01, totaling 200 requests within 2 seconds).
> - **Sliding Window:** Evaluates requests across a continuous sliding time interval from the current timestamp, preventing boundary burst exploitation.

### Q3: What standard HTTP response codes and headers are used in rate limiting?
> **Answer:**
> - **HTTP 429 Too Many Requests:** Standard status code returned when a client exceeds their request limit.
> - **HTTP 403 Forbidden:** Returned when an IP has been blacklisted or blocked due to persistent abuse.
> - **Headers:**
>   - `X-RateLimit-Limit`: Maximum requests allowed in the current window.
>   - `X-RateLimit-Remaining`: Remaining requests allowed before hitting the limit.
>   - `X-RateLimit-Reset`: UTC epoch timestamp in seconds when the window resets.
>   - `Retry-After`: Number of seconds the client must wait before making another request.

### Q4: Why is blindly trusting the `X-Forwarded-For` header dangerous?
> **Answer:** Any client can fabricate an `X-Forwarded-For` header containing arbitrary or spoofed IP addresses. If an application blindly trusts this header without being deployed behind a configured reverse proxy, malicious actors can easily bypass rate limits and IP bans by spoofing different IPs on each request.

### Q5: How does this project handle JSON database concurrency and avoid corrupted files?
> **Answer:** 
> 1. **Per-file Promise Queuing:** Concurrent read/write tasks are chained sequentially to prevent overlapping write operations.
> 2. **Atomic Writes:** Data is written to a temporary file (`*.tmp`) and replaced via atomic filesystem rename (`fs.rename`).
> 3. **Corruption Detection & Backup:** If JSON parsing encounters corrupted syntax, it automatically creates a `.corrupt_<timestamp>.bak` backup and safely reinitializes default data.

### Q6: How does automatic IP blocking work in this application?
> **Answer:** When a client exceeds their rate limit, a `RATE_LIMIT_VIOLATION` is recorded and an internal violation counter is incremented. When the violation count reaches `VIOLATION_THRESHOLD` (e.g., 3), `blockService.blockIp()` is triggered, adding the IP to `ip_blocks.json` with an expiration timestamp (`blockedUntil = Date.now() + BLOCK_DURATION_MS`). The `ipBlocker` middleware immediately intercepts subsequent requests with `403 Forbidden`.

### Q7: How are expired IP blocks handled?
> **Answer:** When an incoming request from a previously blocked IP arrives, `isIpBlocked(ip)` evaluates whether `blockedUntil` is in the past. If expired, the block status is marked as `EXPIRED` in the database and access is seamlessly restored. A background interval also runs every 60 seconds to clean expired records.

### Q8: What sensitive data is excluded from security request logs?
> **Answer:** Passwords, authentication tokens (Bearer tokens, API secrets), cookies, session IDs, and full request bodies are strictly excluded from logs to adhere to data privacy principles (e.g., GDPR / OWASP Logging standards) and prevent credential leakage in audit files.

---

## License

This project is licensed under the MIT License — feel free to use and extend for academic and educational purposes.
