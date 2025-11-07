require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")
const path = require("path")
const express = require("express")
const { spawn } = require("child_process")

// Telegram botni token bilan ishga tushirish
const bot = new Telegraf("7878015755:AAFhNg_aY25FxaXKEGSzHUGOcaa5_Zi_RIM")

// Yuklab olingan fayllarni saqlash uchun vaqtinchalik papka yaratish
const tempDir = path.join(__dirname, "temp")
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir)
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
 * TikTok videoni yuklab olish
 */
const downloadTikTokVideo = async (url, ctx) => {
  try {
    if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
      url = await resolveRedirect(url)
    }

    const processingMsg = await ctx.reply("⏳ TikTok videoni yuklab olish boshlandi...")

    const response = await axios.get("https://tiktok-video-no-watermark2.p.rapidapi.com/", {
      params: { url, hd: 1 },
      headers: {
        "X-RapidAPI-Key": "55c1142c8dmshe3642fb6859f937p104c2ejsnac67748d4751",
        "X-RapidAPI-Host": "tiktok-video-no-watermark2.p.rapidapi.com",
      },
      timeout: 15000,
    })

    const videoUrl = response.data?.data?.play || response.data?.data?.hdplay
    if (videoUrl && /^https?:\/\//.test(videoUrl)) {
      await ctx.replyWithVideo(videoUrl)
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
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
 * YouTube videosi ma'lumotlarini olish
 */
const getYouTubeVideoInfo = async (videoId) => {
  try {
    const response = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
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
 * YouTube video qualities ro'yxatini olish
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
        timeout: 30000,
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
 * YENGI: RapidAPI orqali video/audio yuklab olish va yuborish
 */
const downloadViaRapidAPI = async (url, quality, ctx, videoInfo) => {
  try {
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
    if (!videoId) return false

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
        timeout: 30000,
      }
    )

    if (quality === "audio" && response.data.audios && response.data.audios.items && response.data.audios.items.length > 0) {
      // Audio yuklab olish
      const audioItem = response.data.audios.items[0] // Eng yaxshi audioni olish
      
      // Faylni yuklab olish
      const audioResponse = await axios.get(audioItem.url, { responseType: 'stream' })
      
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
      // Video yuklab olish
      const videoFormat = response.data.videos.items.find(v => 
        v.url && v.quality === quality && v.extension === "mp4"
      )
      
      if (videoFormat) {
        // Faylni yuklab olish
        const videoResponse = await axios.get(videoFormat.url, { responseType: 'stream' })
        
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
 * yt-dlp orqali rezerv usul
 */
const downloadWithFallback = async (url, quality, ctx, videoInfo) => {
  return new Promise((resolve) => {
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
    const tempFileName = `yt_${videoId}_${quality}_${Date.now()}.mp4`
    const tempFilePath = path.join(tempDir, tempFileName)
    
    // Yumshoq format specifications to avoid YouTube blocking
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
 * YouTube videosini yuklab olish - YAXSHILANGAN YONDASHUV
 */
const downloadYouTubeVideoByQuality = async (url, quality, ctx) => {
  const processingMsg = await ctx.reply(`⏳ ${quality} sifatida video yuklab olish boshlandi...`)

  try {
    const videoId = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1]
    if (!videoId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      return ctx.reply("❌ YouTube video ID topilmadi.")
    }

    const videoInfo = await getYouTubeVideoInfo(videoId)
    
    // Birinchi usul: RapidAPI orqali
    const rapidApiSuccess = await downloadViaRapidAPI(url, quality, ctx, videoInfo)
    
    if (rapidApiSuccess) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      console.log(`✅ ${quality} sent via RapidAPI`)
      return
    }
    
    // Ikkinchi usul: yt-dlp fallback
    const fallbackSuccess = await downloadWithFallback(url, quality, ctx, videoInfo)
    
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
    
    if (!fallbackSuccess) {
      ctx.reply(`❌ ${quality} sifatida videoni yuklab bo'lmadi.\n\n📋 Muammolar:\n• YouTube video himoyalangan\n• Internet aloqasi muammo\n• Telegram fayl limiti`)
    }
    
  } catch (error) {
    console.error("YouTube video yuklab olish xatosi:", error.message)
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
    ctx.reply(`❌ ${quality} sifatida videoni yuklab bo'lmadi.`)
  }
}

// --- Telegram Bot Buyruqlari ---

bot.start((ctx) =>
  ctx.replyWithHTML(
    "🎬 <b>Video Yuklovchi Botga Xush Kelibsiz!</b>\n\n" +
      "📱 TikTok: <code>https://vm.tiktok.com/...</code>\n" +
      "📺 YouTube: <code>https://youtu.be/...</code>\n\n" +
      "⚠️ <i>YouTube videolar uchun sifat tanlash tugmalari chiqadi</i>\n\n" +
      "Iltimos, video linkini yuboring.",
  ),
)

bot.help((ctx) =>
  ctx.replyWithHTML(
    "🤖 <b>Yordam</b>\n\n" +
      "1. TikTok link yuboring - Bot videoni to'g'ridan-to'g'ri yuboradi\n" +
      "2. YouTube link yuboring - Sifat tanlash tugmalari chiqadi\n\n" +
      "📝 <b>Qo'llab-quvvatlanadigan formatlar:</b>\n" +
      "• TikTok: vm.tiktok.com, tiktok.com\n" +
      "• YouTube: youtube.com, youtu.be\n\n" +
      "🎛️ <b>Sifatlar:</b> 144p, 240p, 360p, 480p, 720p, 1080p, Audio\n\n" +
      "📱 <b>Yangilangan xususiyatlar:</b>\n" +
      "• 1080p video to'g'ridan-to'g'ri yuboriladi\n" +
      "• Audio tugmasi audio fayl yuboradi\n" +
      "• Yaxshilangan YouTube himoyasi",
  ),
)

bot.on("text", async (ctx) => {
  const link = ctx.message.text.trim()

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
          `📊 Mavjud sifatlar tanlang:`,
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
  } else {
    ctx.reply("❌ Faqat YouTube yoki TikTok linkini yuboring.")
  }
})

// Callback query handler (Telegram tugmalar uchun)
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data
  
  if (callbackData.startsWith("yt_")) {
    const parts = callbackData.split("_")
    const videoId = parts[1]
    const quality = parts[2]
    const originalLink = `https://youtube.com/watch?v=${videoId}`
    
    await ctx.answerCbQuery() // Callback query ni javoblash
    
    await downloadYouTubeVideoByQuality(originalLink, quality, ctx)
  }
})

// Xatolarni ushlash
bot.catch((err, ctx) => {
  console.error("Bot xatosi:", err)
  ctx.reply("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
})

// --- Express Server ---
const app = express()
app.use(express.json())

const WEBHOOK_PATH = `/webhook/${bot.secretPathComponent()}`
const PORT = process.env.PORT || 3000
const WEBHOOK_URL = process.env.WEBHOOK_URL

app.use(bot.webhookCallback(WEBHOOK_PATH))

app.get("/", (req, res) => res.send("Bot ishlayapti ✅"))
app.get("/health", (req, res) => res.json({ status: "OK", timestamp: new Date().toISOString() }))

app.listen(PORT, async () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`)

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

process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))
