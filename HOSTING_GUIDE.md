# 🚀 Bot Hosting Qo'llanmasi - Sleep Prevention

## Yangilangan Xususiyatlar

### ✅ **1. Keep-Alive Tizimi**
- **Qilgan ishi**: Bot avtomatik ravishda har 5 daqiqada "ping" yuboradi
- **Natija**: Hosting platformasi botni "sleep" holatiga tushirmaydi
- **Kuzatish**: Console da "🔄 Keep-alive ping" xabarlari ko'rinadi

### ✅ **2. Health Check Endpoints**
Bot quyidagi URL'larda health check xizmatlarini ta'minlaydi:

**Asosiy app (3000 port):**
- `GET /health` - Bot holati va uptime
- `GET /status` - Bot aktivligi va oxirgi faollik
- `GET /` - Bot haqida umumiy ma'lumot

**Alohida health server (3001 port):**
- `GET /health` - Batafsil health ma'lumotlari
- `GET /uptime` - Bot ishga tushgan vaqtdan boshlab uptime
- `GET /status` - Bot statusi
- `GET /keep-alive` - Manual keep-alive endpoint
- `GET /monitor` - Memory va performance monitoring

### ✅ **3. Activity Tracking**
- **Faollik monitoring**: Bot har bir harakatda activity vaqtini yangilaydi
- **Last activity tracking**: Oxirgi faollik vaqti kuzatiladi
- **Memory monitoring**: Har 10 daqiqada memory usage ko'rsatiladi

### ✅ **4. Optimized Timeouts**
- **API Timeout**: 25 soniya (hosting uchun optimizatsiya qilingan)
- **Download Timeout**: 30 soniya
- **General Timeout**: Qisqartirilgan

### ✅ **5. Graceful Shutdown**
- SIGINT/SIGTERM signalarini to'g'ri qayta ishlaydi
- Fayllarni tozalash
- Serverlarni toza yopish

## 🔧 Hosting Platform Konfiguratsiyasi

### **Environment Variables**
```bash
PORT=3000                    # Asosiy port
HEALTH_PORT=3001             # Health check port
WEBHOOK_URL=your-url.com     # Webhook URL (agar kerak bo'lsa)
```

### **Uptime Monitoring**
Bot quyidagi endpoint'larda o'z statusini ko'rsatadi:
- `yourdomain.com/health`
- `yourdomain.com/status`

### **External Monitoring**
Agar tashqi monitoring xizmatidan foydalanayotgan bo'lsangiz:
```bash
# Health check URL'lari
https://yourdomain.com:3001/health
https://yourdomain.com:3001/keep-alive
```

## 📊 Performance Monitoring

### **Console Log'lari:**
```
🔄 Keep-alive ping: Bot running for 2h 15m 30s
💾 Memory: 45MB used
🏥 Health check server running on port 3001
🚀 Main server running on port 3000
```

### **Health Check Response:**
```json
{
  "status": "OK",
  "bot": "active",
  "uptime": 8100000,
  "uptime_hours": 2,
  "uptime_minutes": 15,
  "last_activity": "2025-01-07T21:00:00.000Z",
  "timestamp": "2025-01-07T21:02:00.000Z",
  "version": "2.0.0",
  "features": ["video_download", "audio_download", "keep_alive"]
}
```

## 🛠️ Hosting Platformlar uchun maxsus sozlash

### **Render.com:**
- Environment variable: `PORT=3000`
- Health check: `https://your-app.onrender.com/health`

### **Heroku:**
- Environment variable: `PORT` avtomatik o'rnatiladi
- Health check: `https://your-app.herokuapp.com/health`

### **Railway:**
- Environment variable: `PORT` avtomatik o'rnatiladi
- Health check: `https://your-app.railway.app/health`

### **Vercel (Serverless):**
- API endpoint yarating `/api/health` kabi
- Background job yordamida keep-alive

## 🔍 Troubleshooting

### **Agar bot hali ham "sleep" ga tushsa:**
1. Health check endpoint'larini test qiling
2. Hosting platformasining sleep konfiguratsiyasini tekshiring
3. External monitoring service (UptimeRobot, Pingdom) qo'shing

### **Performance Issues:**
1. Memory usage ni kuzating
2. API timeout'larni sozlash
3. Fallback mechanism ishlatish

### **Bot Response Time:**
- Tez javob: RapidAPI method (birinchi usul)
- Sekin javob: yt-dlp fallback (ikkinchi usul)

## 💡 Best Practices

1. **External Monitoring**: UptimeRobot yoki boshqa service bilan health check sozlang
2. **Alert Setup**: Bot to'xtab qolsa notification oling
3. **Resource Limits**: Hosting provider limits ni biling
4. **Restart Logic**: Auto-restart feature'ni yoqish
5. **Log Monitoring**: Console log'larni kuzatib boring

## 📈 Stats va Monitoring

Bot endi quyidagi ma'lumotlarni ta'minlaydi:
- ✅ Uptime tracking
- ✅ Activity monitoring  
- ✅ Memory usage
- ✅ Health check endpoints
- ✅ Keep-alive pings
- ✅ Graceful shutdown

**Natija**: Bot hosting platformlarida "sleep" holatiga tushmasdan doimiy ishlaydi!
