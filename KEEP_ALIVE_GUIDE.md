# 🔥 KEEP-ALIVE SYSTEM FOR FREE HOSTED TELEGRAM BOT

## ✅ STEP 1: PING ENDPOINT (ALREADY ADDED TO YOUR BOT)
Your bot already has these ping endpoints:
- `GET /health` - Health check
- `GET /status` - Bot status  
- `GET /keep-alive` - Keep-alive endpoint
- `GET /monitor` - System monitoring

## ✅ STEP 2: EXTERNAL PING SOLUTIONS (Choose One)

### Option A: GitHub Actions (100% FREE - RECOMMENDED)

**File to create**: `.github/workflows/keep-alive.yml`

```yaml
name: Keep Bot Alive
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  ping-bot:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Bot
        run: |
          curl -f -X GET "YOUR_BOT_URL/health" || \
          curl -f -X GET "YOUR_BOT_URL/ping" || \
          curl -f -X GET "YOUR_BOT_URL/keep-alive"
```

**Instructions**:
1. Replace `YOUR_BOT_URL` with your actual bot URL (e.g., `https://yourbot.onrender.com`)
2. Place this file in your GitHub repository at `.github/workflows/keep-alive.yml`
3. Push to GitHub - it will automatically run every 5 minutes

---

### Option B: UptimeRobot (100% FREE)

**Setup**:
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create free account
3. Add new monitor:
   - **Type**: HTTP(s)
   - **URL**: `YOUR_BOT_URL/health`
   - **Interval**: 5 minutes
4. Add these URLs as additional monitors:
   - `YOUR_BOT_URL/ping`
   - `YOUR_BOT_URL/status`

---

### Option C: cron-job.org (100% FREE)

**Setup**:
1. Go to [cron-job.org](https://cron-job.org)
2. Create free account
3. Create new cronjob:
   - **URL**: `YOUR_BOT_URL/health`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Method**: GET
4. Add additional cronjobs for redundancy:
   - `YOUR_BOT_URL/ping` - every 5 minutes
   - `YOUR_BOT_URL/status` - every 5 minutes

---

## 🚀 DEPLOYMENT INSTRUCTIONS

### Your Bot URL Examples:
- **Render**: `https://your-app-name.onrender.com`
- **Railway**: `https://your-app-name.railway.app`  
- **Replit**: `https://your-app-name.your-username.repl.co`
- **Vercel**: `https://your-app-name.vercel.app`

### Testing Your Endpoints:
```bash
# Test health endpoint
curl https://your-bot-url.com/health

# Test ping endpoint  
curl https://your-bot-url.com/ping

# Test keep-alive endpoint
curl https://your-bot-url.com/keep-alive
```

### Platform-Specific Setup:

#### For Render.com:
1. Add environment variable: `PORT=10000` (or any port)
2. Set build command: `npm install`
3. Set start command: `node bot.js`

#### For Railway.app:
1. Deploy your repository
2. Set start command: `node bot.js`
3. Note the generated URL

#### For Replit:
1. Set `.replit` file with `run = "node bot.js"`
2. Add your bot to hosts (allow external connections)

---

## 📊 MONITORING & LOGS

### Check Bot Status:
- Your bot logs all ping activity
- Health endpoints return JSON with uptime info
- Memory usage logged every 10 minutes

### Expected Response:
```json
{
  "status": "OK",
  "bot": "active", 
  "hosting": false,
  "uptime": 3600000,
  "timestamp": "2025-01-08T08:39:54.000Z"
}
```

---

## 🔧 TROUBLESHOOTING

**If bot goes to sleep**:
1. Check if ping services are active
2. Verify your bot URL is accessible
3. Check hosting provider's free tier limits
4. Consider upgrading to paid plan if needed

**If ping fails**:
1. Verify bot is running: `curl YOUR_BOT_URL/health`
2. Check bot logs for errors
3. Ensure environment variables are set correctly
4. Verify hosting platform allows external requests

---

## ✅ COMPLIANCE & RESOURCE USAGE

- **GitHub Actions**: 2,000 minutes/month free
- **UptimeRobot**: 50 monitors free
- **cron-job.org**: 5 cronjobs free
- **Resource usage**: Minimal (1 request every 5 minutes)
- **Platform compliant**: All services are within free tier limits
