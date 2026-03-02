# PTC Vehicle Cron Job - Background Worker Solution

## 🎯 Problem Solved
- **Issue**: cron-job.org has 30-second timeout
- **Solution**: Background worker processes vehicles independently
- **Result**: No timeouts, unlimited processing time

## 🏗️ Architecture

```
┌─────────────────┐
│  cron-job.org   │  (Triggers API)
│  or Manual Call │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express API    │  (Returns immediately)
│  /api/vehicle/  │
│  update-all     │
└────────┬────────┘
         │
         │ Triggers (non-blocking)
         ▼
┌─────────────────┐
│  worker.js      │  (Processes in background)
│  - Fetches DVSA │
│  - Updates DB   │
│  - No timeout   │
└─────────────────┘
```

## 📦 Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
npm start
```

The worker automatically starts and schedules daily at 2 AM.

### 3. Manual Trigger (Optional)
```bash
curl http://localhost:5000/api/vehicle/update-all
```

Response (instant):
```json
{
  "success": true,
  "message": "Vehicle processing started in background",
  "vehiclesToProcess": 150
}
```

## 🚀 Production Deployment (PM2)

### Install PM2
```bash
npm install -g pm2
```

### Start with PM2
```bash
pm2 start ecosystem.config.js
```

### Monitor
```bash
pm2 logs ptc-backend
pm2 monit
```

### Auto-start on reboot
```bash
pm2 startup
pm2 save
```

## ⏰ Cron Schedule

Default: **Every day at 2 AM**

To change schedule, edit `worker.js`:
```javascript
cron.schedule("0 2 * * *", () => { ... });
```

Examples:
- Every hour: `"0 * * * *"`
- Every 6 hours: `"0 */6 * * *"`
- Every Monday 9 AM: `"0 9 * * 1"`

## 🔧 How It Works

1. **Express API** receives request
2. Returns **immediate response** (< 1 second)
3. **Background worker** processes vehicles
4. No timeout constraints
5. Logs progress in real-time

## ✅ Benefits

✔ No 30-second timeout  
✔ Processes unlimited vehicles  
✔ Auto-retry on failure  
✔ Scheduled execution (2 AM daily)  
✔ Manual trigger available  
✔ Production-ready with PM2  
✔ Real-time logging  

## 📊 Monitoring

Check logs:
```bash
pm2 logs ptc-backend --lines 100
```

Check status:
```bash
pm2 status
```

## 🛠️ Files Modified

- `worker.js` - Background processor (NEW)
- `vehicleCron.controller.js` - Instant response trigger
- `server.js` - Loads worker on startup
- `package.json` - Added node-cron
- `ecosystem.config.js` - PM2 config (NEW)
