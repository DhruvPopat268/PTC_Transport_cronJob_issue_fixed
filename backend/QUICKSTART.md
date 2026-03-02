# 🚀 QUICK START GUIDE

## Step 1: Install node-cron
```bash
npm install
```

## Step 2: Start Server
```bash
npm start
```

You'll see:
```
✅ Worker started - Scheduled for 2 AM daily
🚀 Server running on port 5000
```

## Step 3: Test Manual Trigger
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

## Step 4: Check Logs
Watch console for real-time progress:
```
🚀 [2024-01-15T14:30:00.000Z] Starting vehicle processing...
📊 Found 150 vehicles to process
✅ AB12CDE - Completed
✅ XY34FGH - Completed
❌ ZZ99XXX - Invalid (404)
```

## ✅ DONE!

### What Changed?
- ✅ API responds instantly (< 1 second)
- ✅ Processing runs in background
- ✅ No 30-second timeout
- ✅ Auto-runs daily at 2 AM
- ✅ Can trigger manually anytime

### For Production (Optional)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

---

## 🔥 Key Points

1. **cron-job.org will now succeed** because API responds in < 1 second
2. **Background worker processes vehicles** without timeout
3. **Scheduled daily at 2 AM** automatically
4. **Manual trigger available** via API endpoint

## 📞 Endpoints

- `POST /api/vehicle/update-all` - Start processing
- `POST /api/vehicle/set-pending` - Reset all to pending

## ⏰ Cron Schedule

Edit `worker.js` line 186 to change schedule:
```javascript
cron.schedule("0 2 * * *", () => { ... });
```

Common patterns:
- `"0 2 * * *"` - Daily at 2 AM
- `"0 */6 * * *"` - Every 6 hours
- `"0 9 * * 1"` - Every Monday at 9 AM
- `"*/30 * * * *"` - Every 30 minutes
