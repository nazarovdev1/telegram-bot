const { Telegraf } = require("telegraf")
const axios = require("axios")
const fs = require("fs")
const path = require("path")
const express = require("express")

// Telegram botni token bilan ishga tushirish
const bot = new Telegraf("7878015755:AAFhNg_aY25FxaXKEGSzHUGOcaa5_Zi_RIM")

// Yuklab olingan fayllarni saqlash uchun vaqtinchalik papka yaratish
const tempDir = path.join(__dirname, "temp")
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir)
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
 * YouTube video ID ni ajratib olish
 */
const extractYouTubeId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

/**
 * Bepul YouTube API bilan video yuklab olish
 */
const downloadYouTubeVideo = async (url, ctx) => {
  try {
    const processingMsg = await ctx.reply("⏳ YouTube videoni yuklab olish boshlandi...")

    const videoId = extractYouTubeId(url)
    if (!videoId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      return ctx.reply("❌ YouTube video ID topilmadi.")
    }

    // 1-usul: Bepul YouTube downloader API
    try {
      const response = await axios.get(`https://api.cobalt.tools/api/json`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        data: {
          url: url,
          vQuality: "480",
        },
        timeout: 30000,
      })

      if (response.data && response.data.url) {
        await ctx.replyWithVideo(response.data.url, {
          caption: `🎬 YouTube Video`,
        })
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
        return
      }
    } catch (error) {
      console.log("Cobalt API xatosi:", error.message)
    }

    // 2-usul: Boshqa bepul API
    try {
      const response = await axios.post(
        "https://www.klickaud.co/api/convert",
        {
          url: url,
          format: "mp4",
        },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 30000,
        },
      )

      if (response.data && response.data.download_url) {
        await ctx.replyWithVideo(response.data.download_url, {
          caption: `🎬 YouTube Video`,
        })
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
        return
      }
    } catch (error) {
      console.log("Klickaud API xatosi:", error.message)
    }

    // 3-usul: YouTube video ma'lumotlarini olish va foydalanuvchiga link berish
    try {
      const videoInfo = await getYouTubeVideoInfo(videoId)
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)

      await ctx.replyWithHTML(
        `🎬 <b>${videoInfo.title}</b>\n\n` +
          `⏱ Davomiyligi: ${videoInfo.duration}\n` +
          `👀 Ko'rishlar: ${videoInfo.views}\n\n` +
          `📥 Video yuklab olish uchun quyidagi linkdan foydalaning:\n` +
          `<a href="https://www.y2mate.com/youtube/${videoId}">Y2mate orqali yuklab olish</a>\n\n` +
          `yoki\n\n` +
          `<a href="https://ssyoutube.com/watch?v=${videoId}">SSYouTube orqali yuklab olish</a>`,
      )
    } catch (error) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      ctx.reply(
        "❌ YouTube videoni yuklab bo'lmadi. Iltimos, quyidagi linkdan foydalaning:\n" +
          `https://www.y2mate.com/youtube/${videoId}`,
      )
    }
  } catch (error) {
    console.error("YouTube xatosi:", error.message)
    ctx.reply("❌ YouTube videoni yuklab bo'lmadi.")
  }
}

/**
 * YouTube video ma'lumotlarini olish (bepul)
 */
const getYouTubeVideoInfo = async (videoId) => {
  try {
    // YouTube oEmbed API (bepul va cheklovsiz)
    const response = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    )

    return {
      title: response.data.title,
      duration: "N/A",
      views: "N/A",
    }
  } catch (error) {
    throw new Error("Video ma'lumotlarini olib bo'lmadi")
  }
}

/**
 * TikTok videoni yuklab olish
 */
const downloadTikTokVideo = async (url, ctx) => {
  try {
    // Qisqa TikTok havolalarini to'liq havolalarga o'tkazish
    if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
      url = await resolveRedirect(url)
    }

    const processingMsg = await ctx.reply("⏳ TikTok videoni yuklab olish boshlandi...")

    // RapidAPI TikTok yuklovchi xizmatiga so'rov yuborish
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

// --- Telegram Bot Buyruqlari ---

bot.start((ctx) =>
  ctx.replyWithHTML(
    "🎬 <b>Video Yuklovchi Botga Xush Kelibsiz!</b>\n\n" +
      "📱 TikTok: <code>https://vm.tiktok.com/...</code>\n" +
      "📺 YouTube: <code>https://youtu.be/...</code>\n\n" +
      "⚠️ <i>YouTube videolar uchun yuklab olish linklari beriladi</i>\n\n" +
      "Iltimos, video linkini yuboring.",
  ),
)

bot.help((ctx) =>
  ctx.replyWithHTML(
    "🤖 <b>Yordam</b>\n\n" +
      "1. TikTok link yuboring - Bot videoni to'g'ridan-to'g'ri yuboradi\n" +
      "2. YouTube link yuboring - Bot yuklab olish linkini beradi\n\n" +
      "📝 <b>Qo'llab-quvvatlanadigan formatlar:</b>\n" +
      "• TikTok: vm.tiktok.com, tiktok.com\n" +
      "• YouTube: youtube.com, youtu.be",
  ),
)

bot.on("text", async (ctx) => {
  const link = ctx.message.text.trim()

  if (link.startsWith("/")) return

  if (link.includes("youtube.com") || link.includes("youtu.be")) {
    await downloadYouTubeVideo(link, ctx)
  } else if (link.includes("tiktok.com")) {
    await downloadTikTokVideo(link, ctx)
  } else {
    ctx.reply("❌ Faqat YouTube yoki TikTok linkini yuboring.")
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

  if (!WEBHOOK_URL) {
    console.error("Xato: WEBHOOK_URL muhit o'zgaruvchisi o'rnatilmagan.")
  } else {
    try {
      await bot.telegram.setWebhook(`${WEBHOOK_URL}${WEBHOOK_PATH}`)
      console.log(`Webhook o'rnatildi: ${WEBHOOK_URL}${WEBHOOK_PATH}`)
    } catch (error) {
      console.error("Webhook o'rnatishda xato:", error)
    }
  }
})

process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))
