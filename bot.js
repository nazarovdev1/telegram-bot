require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")
const path = require("path")
const express = require("express")
const { spawn } = require("child_process")

// Telegram botni token bilan ishga tushirish
const bot = new Telegraf("7878015755:AAFhNg_aY25FxaXKEGSzHUGOcaa5_Zi_RIM")

// HOSTING ENVIRONMENT DETECTION
const isHostingEnvironment = () => {
  const hostingIndicators = [
    process.env.RENDER,
    process.env.HEROKU,
    process.env.VERCEL,
    process.env.RAILWAY,
    process.env.NETLIFY,
    process.env.DIGITALOCEAN,
    process.env.HOSTING,
    process.env.PORT && process.env.PORT !== '3000'
  ]
  return hostingIndicators.some(indicator => indicator === true || indicator === 'true')
}

const isHosting = isHostingEnvironment()
console.log(`🌐 Hosting environment detected: ${isHosting}`)

// Yuklab olingan fayllarni saqlash uchun vaqtinchalik papka yaratish
const tempDir = path.join(__dirname, "temp")
if (!isHosting && !fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir)
}

// --- HOSTING UCHUN KEEP-ALIVE XUSUSIYATLARI ---

// Bot status va uptime tracking
let botStartTime = Date.now()
let lastActivityTime = Date.now()
let isActive = true

// Uptime monitoring
const getUptime = () => {
  const uptime = Date.now() - botStartTime
  const hours = Math.floor(uptime / (1000 * 60 * 60))
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((uptime % (1000 * 60)) / 1000)
  return { hours, minutes, seconds, total: uptime }
}

// Activity tracking
const updateActivity = () => {
  lastActivityTime = Date.now()
  isActive = true
}

// Keep-alive interval (hosting uchun qisqaroq)
const KEEP_ALIVE_INTERVAL = isHosting ? 2 * 60 * 1000 : 5 * 60 * 1000 // 2 minutes for hosting

// Periodic keep-alive function
const startKeepAlive = () => {
  setInterval(() => {
    const uptime = getUptime()
    console.log(`🔄 Keep-alive ping: Bot running for ${uptime.hours}h ${uptime.minutes}m ${uptime.seconds}s`)
    isActive = true
  }, KEEP_ALIVE_INTERVAL)
}

// Health check for hosting platforms
const startHealthServer = () => {
  const healthApp = express()
  healthApp.use(express.json())

  // Health check endpoint
  healthApp.get('/health', (req, res) => {
    const uptime = getUptime()
    res.json({
      status: 'OK',
      bot: 'active',
      hosting: isHosting,
      uptime: uptime.total,
      uptime_hours: uptime.hours,
      uptime_minutes: uptime.minutes,
      last_activity: lastActivityTime,
      timestamp: new Date().toISOString(),
      version: '2.1.0',
      features: ['video_download', 'audio_download', 'keep_alive', 'hosting_optimized']
    })
  })

  // Simple uptime endpoint
  healthApp.get('/uptime', (req, res) => {
    const uptime = getUptime()
    res.send(`Bot uptime: ${uptime.hours}:${uptime.minutes}:${uptime.seconds}`)
  })

  // Bot status endpoint
  healthApp.get('/status', (req, res) => {
    res.json({
      active: isActive,
      hosting: isHosting,
      last_activity: new Date(lastActivityTime).toISOString(),
      uptime: getUptime()
    })
  })

  // Keep-alive endpoint for hosting
  healthApp.get('/keep-alive', (req, res) => {
    updateActivity()
    res.json({
      message: 'Bot is alive and active',
      hosting: isHosting,
      timestamp: new Date().toISOString()
    })
  })

  // Monitoring endpoint
  healthApp.get('/monitor', (req, res) => {
    res.json({
      memory: process.memoryUsage(),
      uptime: getUptime(),
      platform: process.platform,
      node_version: process.version,
      active: isActive,
      hosting: isHosting
    })
  })

  const HEALTH_PORT = process.env.HEALTH_PORT || 3001
  healthApp.listen(HEALTH_PORT, () => {
    console.log(`🏥 Health check server running on port ${HEALTH_PORT}`)
  })
}

/**
 * YouTube videosi uchun inline keyboard tugmalarini yaratadi
 */
const createQualityKeyboard = (videoId, availableQualities) => {
  const buttons = []
  const qualities = ["144p", "240p", "360p", "480p", "720p", "1080p"]

  for (let i = 0; i < qualities.length; i += 2) {
    const row = []
    if (qualities[i] && availableQualities.includes(qualities[i])) {
      row.push(Markup.button.callback(`📺 ${qualities[i]}`, `yt_${videoId}_${qualities[i]}`))
    }
    if (qualities[i + 1] && availableQualities.includes(qualities[i + 1])) {
      row.push(Markup.button.callback(`📺 ${qualities[i + 1]}`, `yt_${videoId}_${qualities[i + 1]}`))
    }
    if (row.length > 0) {
      buttons.push(row)
    }
  }

  // Audio tugmasini qo'shish
  buttons.push([Markup.button.callback("🎵 Audio", `yt_${videoId}_audio`)])

  return Markup.inlineKeyboard(buttons)
}

/**
 * TikTok qisqa havolasini to'liq havolaga o'tkazadi.
 */
const resolveRedirect = async (shortUrl) => {
  try {
    const response = await axios.head(shortUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    })
    return response.headers.location || shortUrl
  } catch (error) {
    return error.response?.headers?.location || shortUrl
  }
}

/**
 * TikTok videoni yuklab olish - HOSTING UCHUN OPTIMIZATSIYA
 */
const downloadTikTokVideo = async (url, ctx) => {
  try {
    if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
      url = await resolveRedirect(url)
    }

    updateActivity()
    const processingMsg = await ctx.reply("⏳ TikTok videoni yuklab olish boshlandi...")

    const response = await axios.get("https://tiktok-video-no-watermark2.p.rapidapi.com/", {
      params: { url, hd: 1 },
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "tiktok-video-no-watermark2.p.rapidapi.com",
      },
      timeout: isHosting ? 15000 : 20000, // Shorter timeout for hosting
    })

    const videoUrl = response.data?.data?.play || response.data?.data?.hdplay
    if (videoUrl && /^https?:\/\//.test(videoUrl)) {
      await ctx.replyWithVideo(videoUrl)
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      console.log("✅ TikTok video sent successfully")
    } else {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      ctx.reply("❌ TikTok videosi topilmadi.")
    }
  } catch (error) {
    console.error("TikTok xatosi:", error.message)
    ctx.reply("❌ TikTok videoni yuklab bo'lmadi.")
  }
}

/**
 * YouTube videosi ma'lumotlarini olish - HOSTING UCHUN OPTIMIZATSIYA
 */
const getYouTubeVideoInfo = async (videoId) => {
  try {
    const response = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { timeout: isHosting ? 8000 : 10000 }
    )
    return {
      title: response.data.title,
      author_name: response.data.author_name,
    }
  } catch (error) {
    return {
      title: "Noma'lum video",
      author_name: "Noma'lum",
    }
  }
}

/**
 * YouTube video qualities ro'yxatini olish - HOSTING OPTIMIZATSIYA
 */
const getYouTubeVideoQualities = async (url, ctx) => {
  try {
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
    if (!videoId) return []

    const response = await axios.get(
      `https://youtube-media-downloader.p.rapidapi.com/v2/video/details`,
      {
        params: {
          videoId: videoId,
          urlAccess: "normal",
          videos: "auto",
          audios: "auto"
        },
        headers: {
          "x-rapidapi-host": "youtube-media-downloader.p.rapidapi.com",
          "x-rapidapi-key": "55c1142c8dmshe3642fb6859f937p104c2ejsnac67748d4751",
        },
        timeout: isHosting ? 20000 : 25000, // Shorter for hosting
      }
    )

    if (response.data && response.data.videos && response.data.videos.items) {
      const qualities = response.data.videos.items
        .filter(v => v.url && v.quality && v.extension === "mp4")
        .map(v => v.quality)

      return [...new Set(qualities)]
    }
  } catch (error) {
    console.error("YouTube qualities xatosi:", error.message)
  }
  return []
}

/**
 * HOSTING UCHUN: YouTube video havolasini yuborish (yuklab olmasdan)
 */
const sendYouTubeLinkFallback = async (url, quality, ctx, videoInfo) => {
  try {
    updateActivity()

    const processingMsg = await ctx.reply(`⏳ ${quality} sifatida video tayyorlanmoqda...`)

    // Video ID ni olish
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]

    if (!videoId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      return ctx.reply("❌ YouTube video ID topilmadi.")
    }

    // RapidAPI orqali video URL olish
    const response = await axios.get(
      `https://youtube-media-downloader.p.rapidapi.com/v2/video/details`,
      {
        params: {
          videoId: videoId,
          urlAccess: "normal",
          videos: "auto",
          audios: "auto"
        },
        headers: {
          "x-rapidapi-host": "youtube-media-downloader.p.rapidapi.com",
          "x-rapidapi-key": "55c1142c8dmshe3642fb6859f937p104c2ejsnac67748d4751",
        },
        timeout: 20000,
      }
    )

    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)

    if (quality === "audio" && response.data.audios && response.data.audios.items && response.data.audios.items.length > 0) {
      const audioItem = response.data.audios.items[0]

      await ctx.replyWithHTML(
        `🎵 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n\n` +
        `🎼 Audio yuklab olish uchun quyidagi havolani oching:\n\n` +
        `<a href="${audioItem.url}">📥 Audio yuklab olish</a>\n\n` +
        `⚠️ <i>Hosting muhitida to'g'ridan-to'g'ri yuborish cheklangan\n` +
        `Havolani oching va faylni yuklab oling</i>`,
        { disable_web_page_preview: true }
      )
    } else {
      // Video uchun eng yaxshi formatni topish
      const videoFormat = response.data.videos.items.find(v =>
        v.url && v.quality === quality && v.extension === "mp4"
      ) || response.data.videos.items[0] // Default to first available

      if (videoFormat) {
        await ctx.replyWithHTML(
          `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n📊 Sifat: ${videoFormat.quality}\n\n` +
          `📥 Video yuklab olish uchun quyidagi havolani oching:\n\n` +
          `<a href="${videoFormat.url}">📺 Video yuklab olish</a>\n\n` +
          `⚠️ <i>Hosting muhitida to'g'ridan-to'g'ri yuborish cheklangan\n` +
          `Havolani oching va faylni yuklab oling</i>`,
          { disable_web_page_preview: true }
        )
      } else {
        ctx.reply("❌ Video formatlari topilmadi.")
      }
    }

    return true
  } catch (error) {
    console.error("Link fallback error:", error.message)
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)

    // Oxirgi yechim: YouTube havolasini yuborish
    await ctx.replyWithHTML(
      `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n\n` +
      `📥 <a href="${url}">YouTube da ko'rish</a>\n\n` +
      `⚠️ <i>Hosting muhitida yuklab olish cheklangan</i>`,
      { disable_web_page_preview: true }
    )
    return true
  }
}

/**
 * RapidAPI orqali video/audio yuklab olish - HOSTING OPTIMIZATSIYA
 */
const downloadViaRapidAPI = async (url, quality, ctx, videoInfo) => {
  try {
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
    if (!videoId) return false

    updateActivity()

    const response = await axios.get(
      `https://youtube-media-downloader.p.rapidapi.com/v2/video/details`,
      {
        params: {
          videoId: videoId,
          urlAccess: "normal",
          videos: "auto",
          audios: "auto"
        },
        headers: {
          "x-rapidapi-host": "youtube-media-downloader.p.rapidapi.com",
          "x-rapidapi-key": "55c1142c8dmshe3642fb6859f937p104c2ejsnac67748d4751",
        },
        timeout: isHosting ? 20000 : 25000, // Hosting uchun qisqa timeout
      }
    )

    if (quality === "audio" && response.data.audios && response.data.audios.items && response.data.audios.items.length > 0) {
      const audioItem = response.data.audios.items[0]

      // HOSTING: Fayl yuklab olish o'rniga link yuborish
      if (isHosting) {
        await ctx.replyWithHTML(
          `🎵 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n\n` +
          `🎼 Audio yuklab olish uchun quyidagi havolani oching:\n\n` +
          `<a href="${audioItem.url}">📥 Audio yuklab olish</a>\n\n` +
          `⚠️ <i>Hosting muhitida to'g'ridan-to'g'ri yuborish cheklangan</i>`,
          { disable_web_page_preview: true }
        )
        return true
      }

      // LOCAL: To'g'ridan-to'g'ri yuborish
      const audioResponse = await axios.get(audioItem.url, {
        responseType: 'stream',
        timeout: 30000
      })

      await ctx.replyWithAudio(
        { source: audioResponse.data },
        {
          caption: `🎵 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n🎼 Audio`,
          parse_mode: "HTML"
        }
      )

      return true
    }

    if (quality !== "audio" && response.data.videos && response.data.videos.items && response.data.videos.items.length > 0) {
      const videoFormat = response.data.videos.items.find(v =>
        v.url && v.quality === quality && v.extension === "mp4"
      )

      if (videoFormat) {
        // HOSTING: Fayl yuklab olish o'rniga link yuborish
        if (isHosting) {
          await ctx.replyWithHTML(
            `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n📊 Sifat: ${videoFormat.quality}\n\n` +
            `📥 Video yuklab olish uchun quyidagi havolani oching:\n\n` +
            `<a href="${videoFormat.url}">📺 Video yuklab olish</a>\n\n` +
            `⚠️ <i>Hosting muhitida to'g'ridan-to'g'ri yuborish cheklangan</i>`,
            { disable_web_page_preview: true }
          )
          return true
        }

        // LOCAL: To'g'ridan-to'g'ri yuborish
        const videoResponse = await axios.get(videoFormat.url, {
          responseType: 'stream',
          timeout: 30000
        })

        await ctx.replyWithVideo(
          { source: videoResponse.data },
          {
            caption: `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n📊 Sifat: ${videoFormat.quality}`,
            parse_mode: "HTML"
          }
        )

        return true
      }
    }

    return false
  } catch (error) {
    console.error("RapidAPI download error:", error.message)
    return false
  }
}

/**
 * yt-dlp orqali rezerv usul - FAQAT LOCAL UCHUN
 */
const downloadWithFallback = async (url, quality, ctx, videoInfo) => {
  // HOSTING da yt-dlp ishlatmaysiz
  if (isHosting) {
    console.log("🚫 yt-dlp fallback disabled on hosting environment")
    return false
  }

  return new Promise((resolve) => {
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
    const tempFileName = `yt_${videoId}_${quality}_${Date.now()}.mp4`
    const tempFilePath = path.join(tempDir, tempFileName)

    let args = []
    if (quality === "audio") {
      args = ["-f", "bestaudio", "--extract-audio", "-o", tempFilePath, url]
    } else {
      args = ["-f", "best", "-o", tempFilePath, url]
    }

    console.log("yt-dlp fallback arguments:", args.join(" "))

    const ytDlp = spawn(path.join(__dirname, "bin", "yt-dlp.exe"), args)

    ytDlp.on("close", async (code) => {
      if (code === 0 && fs.existsSync(tempFilePath)) {
        try {
          const fileSize = fs.statSync(tempFilePath).size

          if (quality === "audio") {
            const audioStream = fs.createReadStream(tempFilePath)
            await ctx.replyWithAudio(
              { source: audioStream },
              { caption: `🎵 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}`, parse_mode: "HTML" }
            )
          } else {
            const videoStream = fs.createReadStream(tempFilePath)
            await ctx.replyWithVideo(
              { source: videoStream },
              { caption: `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}`, parse_mode: "HTML" }
            )
          }

          fs.unlinkSync(tempFilePath)
          updateActivity()
          console.log(`✅ ${quality} sent via yt-dlp fallback`)
          resolve(true)
        } catch (error) {
          console.error("yt-dlp fallback send error:", error.message)
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
          resolve(false)
        }
      } else {
        console.log("yt-dlp fallback failed")
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        resolve(false)
      }
    })
  })
}

/**
 * YouTube videosini yuklab olish - HOSTING AWARE
 */
const downloadYouTubeVideoByQuality = async (url, quality, ctx) => {
  const processingMsg = await ctx.reply(`⏳ ${quality} sifatida video yuklab olish boshlandi...`)

  try {
    updateActivity()
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
    if (!videoId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      return ctx.reply("❌ YouTube video ID topilmadi.")
    }

    const videoInfo = await getYouTubeVideoInfo(videoId)

    if (isHosting) {
      // HOSTING: Link-based approach
      const linkSuccess = await sendYouTubeLinkFallback(url, quality, ctx, videoInfo)
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)

      if (!linkSuccess) {
        ctx.reply(`❌ ${quality} sifatida videoni yuklab bo'lmadi.\n\n📋 Hosting muammosi:\n• Internet cheklovlari\n• Fayl limiti\n• API cheklovlari`)
      }
      return
    }

    // LOCAL: Full download approach
    const rapidApiSuccess = await downloadViaRapidAPI(url, quality, ctx, videoInfo)

    if (rapidApiSuccess) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      console.log(`✅ ${quality} sent via RapidAPI`)
      return
    }

    const fallbackSuccess = await downloadWithFallback(url, quality, ctx, videoInfo)

    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)

    if (!fallbackSuccess) {
      ctx.reply(`❌ ${quality} sifatida videoni yuklab bo'lmadi.\n\n📋 Muammolar:\n• YouTube himoyasi\n• Internet aloqasi\n• Fayl limiti`)
    }

  } catch (error) {
    console.error("YouTube video yuklab olish xatosi:", error.message)
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
    ctx.reply(`❌ ${quality} sifatida videoni yuklab bo'lmadi.`)
  }
}

// --- TELEGRAM BOT BUYRUQLARI ---

bot.start((ctx) => {
  updateActivity()
  ctx.reply(
    `🎬 Video Yuklovchi Botga Xush Kelibsiz!\n\n📱 TikTok: https://vm.tiktok.com/...\n📺 YouTube: https://youtu.be/...\n📸 Instagram: https://instagram.com/reel/...\n\nIltimos, video linkini yuboring.`
  )
})

bot.help((ctx) => {
  updateActivity()
  ctx.replyWithHTML(
    "🤖 <b>Yordam</b>\n\n" +
      "1. TikTok link yuboring - Bot videoni to'g'ridan-to'g'ri yuboradi\n" +
      "2. YouTube link yuboring - Sifat tanlash tugmalari chiqadi\n\n" +
      "📝 <b>Qo'llab-quvvatlanadigan formatlar:</b>\n" +
      "• TikTok: vm.tiktok.com, tiktok.com\n" +
      "• YouTube: youtube.com, youtu.be\n\n" +
      "🎛️ <b>Sifatlar:</b> 144p, 240p, 360p, 480p, 720p, 1080p, Audio\n\n" +
      "📱 <b>Yangilangan xususiyatlar:</b>\n" +
      `• ${isHosting ? 'Hosting uchun optimizatsiya qilingan' : 'To\'g\'ridan-to\'g\'ri yuklab olish'}\n` +
      "• Audio tugmasi ham audio fayl yuboradi\n" +
      "• Keep-alive tizimi\n" +
      `• ${isHosting ? 'Hosting environment detected' : 'Local environment'}`,
  )
})

bot.on("text", async (ctx) => {
  const link = ctx.message.text.trim()
  updateActivity()

  if (link.startsWith("/")) return

  if (link.includes("youtube.com") || link.includes("youtu.be")) {
    const processingMsg = await ctx.reply("⏳ Video ma'lumotlarini olish...")

    try {
      const videoId = link.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
      const videoInfo = await getYouTubeVideoInfo(videoId)
      const availableQualities = await getYouTubeVideoQualities(link, ctx)

      console.log("Mavjud sifatlar:", availableQualities)

      if (availableQualities.length > 0) {
        const keyboard = createQualityKeyboard(videoId, availableQualities)
        await ctx.replyWithHTML(
          `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n\n` +
          `📊 Mavjud sifatlar tanlang:\n` +
          `${isHosting ? '⚠️ Hosting muhitida havolalar yuboriladi' : '💾 Lokal muhitda to\'g\'ridan-to\'g\'ri yuboriladi'}`,
          keyboard
        )
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      } else {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
        ctx.reply("❌ Video ma'lumotlari topilmadi.")
      }
    } catch (error) {
      console.error("YouTube video ma'lumotlar xatosi:", error.message)
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      ctx.reply("❌ Video ma'lumotlarini olishda xato yuz berdi.")
    }
  } else if (link.includes("tiktok.com")) {
    await downloadTikTokVideo(link, ctx)
  } else if (link.includes("instagram.com") || link.includes("instagr.am")) {
    await require("./instagram").downloadInstagramVideo(link, ctx)
  } else {
    ctx.reply("❌ Faqat YouTube, TikTok yoki Instagram linkini yuboring.")
  }
})

// Callback query handler (Telegram tugmalar uchun)
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data
  updateActivity()

  if (callbackData.startsWith("yt_")) {
    const parts = callbackData.split("_")
    const videoId = parts[1]
    const quality = parts[2]
    const originalLink = `https://youtube.com/watch?v=${videoId}`

    await ctx.answerCbQuery()

    await downloadYouTubeVideoByQuality(originalLink, quality, ctx)
  }
})

// Xatolarni ushlash
bot.catch((err, ctx) => {
  console.error("Bot xatosi:", err)
  ctx.reply("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
})

// --- EXPRESS SERVER - HOSTING UCHUN KENGAYTIRILGAN ---

const app = express()
app.use(express.json())

const WEBHOOK_PATH = `/webhook/${bot.secretPathComponent()}`
const PORT = process.env.PORT || 3000
const WEBHOOK_URL = process.env.WEBHOOK_URL

app.use(bot.webhookCallback(WEBHOOK_PATH))

// Health check endpoint for main app
app.get("/health", (req, res) => {
  const uptime = getUptime()
  res.json({
    status: "OK",
    bot: "active",
    hosting: isHosting,
    uptime: uptime.total,
    timestamp: new Date().toISOString(),
    hosting_optimized: true
  })
})

// Bot status endpoint
app.get("/status", (req, res) => {
  res.json({
    active: isActive,
    hosting: isHosting,
    uptime: getUptime(),
    last_activity: new Date(lastActivityTime).toISOString()
  })
})

app.get("/", (req, res) => {
  const uptime = getUptime()
  res.send(`
    <h1>🎬 Video Download Bot</h1>
    <p>Bot is running ✅</p>
    <p>Environment: ${isHosting ? '🌐 Hosting' : '💻 Local'}</p>
    <p>Uptime: ${uptime.hours}h ${uptime.minutes}m ${uptime.seconds}s</p>
    <p>Health: <a href="/health">/health</a></p>
    <p>Status: <a href="/status">/status</a></p>
  `)
})

// Start the main server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Main server running on port ${PORT}`)
  console.log(`📊 Bot uptime tracking started`)
  console.log(`${isHosting ? '🌐 Hosting environment detected' : '💻 Local environment'}`)

  if (WEBHOOK_URL) {
    try {
      await bot.telegram.setWebhook(`${WEBHOOK_URL}${WEBHOOK_PATH}`)
      console.log(`✅ Webhook o'rnatildi: ${WEBHOOK_URL}${WEBHOOK_PATH}`)
    } catch (error) {
      console.error("❌ Webhook o'rnatishda xato:", error)
    }
  } else {
    console.log("🔄 Polling rejimida ishlaydi (development muhitida)")
    bot.launch()
  }
})

// Start keep-alive features
startKeepAlive()
startHealthServer()

// Graceful shutdown handling
process.once("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...")
  bot.stop("SIGINT")
  server.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})

process.once("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...")
  bot.stop("SIGTERM")
  server.close(() => {
    console.log("✅ Server closed")
    console.log("🎬 Video Download Bot Stopped")
    process.exit(0)
  })
})

// Memory monitoring
setInterval(() => {
  const memoryUsage = process.memoryUsage()
  console.log(`💾 Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB used`)
}, 10 * 60 * 1000) // Every 10 minutes

console.log("🎬 Enhanced Video Download Bot with Hosting Support Started!")
console.log(`🌐 Hosting environment: ${isHosting ? 'Yes' : 'No'}`)
console.log("🔄 Keep-alive system active")
console.log("🏥 Health check endpoints available")
console.log("📊 Activity monitoring enabled")
