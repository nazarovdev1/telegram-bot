const { Telegraf } = require("telegraf");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ytdlp = require("yt-dlp-exec"); // yt-dlp-exec kutubxonasini import qilish
const express = require("express");

// Telegram botni token bilan ishga tushirish
const bot = new Telegraf("7878015755:AAFhNg_aY25FxaXKEGSzHUGOcaa5_Zi_RIM");

// Yuklab olingan fayllarni saqlash uchun vaqtinchalik papka yaratish
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

/**
 * TikTok qisqa havolasini to'liq havolaga o'tkazadi.
 * @param {string} shortUrl - Qisqa TikTok havolasi.
 * @returns {Promise<string>} To'liq TikTok havolasi.
 */
const resolveRedirect = async (shortUrl) => {
  try {
    // Qayta yo'naltirish manzilini olish uchun HEAD so'rov yuborish
    const response = await axios.head(shortUrl, {
      maxRedirects: 0, // Avtomatik qayta yo'naltirishlarni kuzatmaslik
      validateStatus: (status) => status >= 200 && status < 400, // Qayta yo'naltirish uchun yaroqli status kodlari
    });
    // Sarlavhalardan yangi manzilni qaytarish yoki qayta yo'naltirish bo'lmasa, asl URLni qaytarish
    return response.headers.location || shortUrl;
  } catch (error) {
    // Xato yuzaga kelsa (masalan, 302 qayta yo'naltirish xato sifatida ushlansa),
    // xato javobining sarlavhalaridan manzilni olish
    return error.response?.headers?.location || shortUrl;
  }
};

/**
 * yt-dlp-exec yordamida YouTube videoni yuklab oladi.
 * @param {string} url - YouTube video havolasi.
 * @param {object} ctx - Telegraf kontekst obyekti.
 */
const downloadYouTubeVideo = async (url, ctx) => {
  try {
    const processingMsg = await ctx.reply("⏳ YouTube videoni yuklab olish boshlandi...");
    const outputPath = path.join(tempDir, `${Date.now()}.mp4`);

    // Videoni yuklab olish uchun yt-dlp ni ishga tushirish
    // execPath opsiyasini 'yt-dlp' qilib belgilash orqali,
    // yt-dlp-exec kutubxonasi yt-dlp ni tizim PATH'idan topishga majbur qilinadi.
    await ytdlp(
      url,
      {
        output: outputPath, // Chiqish fayli yo'lini belgilash
        format: "best[ext=mp4]/best", // Eng yaxshi sifatli MP4 formatini tanlash
      },
      {
        execPath: 'yt-dlp', // yt-dlp ni tizim PATH'idan qidirishni buyurish
      }
    );

    // Yuklab olingan fayl mavjudligini tekshirish
    if (!fs.existsSync(outputPath)) {
      return ctx.reply("❌ Yuklab olingan fayl topilmadi.");
    }

    // Videoni foydalanuvchiga yuborish
    await ctx.replyWithVideo({ source: outputPath });
    // Yuborilgandan so'ng vaqtinchalik faylni o'chirish
    fs.unlinkSync(outputPath);
    // "Yuklanmoqda" xabarini o'chirish
    ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
  } catch (error) {
    console.error("YouTube xatosi:", error);
    ctx.reply("❌ YouTube videoni yuklab bo‘lmadi.");
  }
};

/**
 * RapidAPI xizmati yordamida TikTok videoni yuklab oladi.
 * @param {string} url - TikTok video havolasi.
 * @param {object} ctx - Telegraf kontekst obyekti.
 */
const downloadTikTokVideo = async (url, ctx) => {
  try {
    // Qisqa TikTok havolalarini to'liq havolalarga o'tkazish
    if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
      url = await resolveRedirect(url);
    }

    // RapidAPI TikTok yuklovchi xizmatiga so'rov yuborish
    const response = await axios.get(
      "https://tiktok-video-no-watermark2.p.rapidapi.com/",
      {
        params: { url, hd: 1 }, // HD sifatida so'rov yuborish
        headers: {
          "X-RapidAPI-Key": "55c1142c8dmshe3642fb6859f937p104c2ejsnac67748d4751", // Sizning RapidAPI kalitingiz
          "X-RapidAPI-Host": "tiktok-video-no-watermark2.p.rapidapi.com", // RapidAPI hosti
        },
        timeout: 10000, // 10 soniya vaqt chegarasi
      }
    );

    // Javobdan video URLni ajratib olish
    const videoUrl = response.data?.data?.play || response.data?.data?.hdplay;
    if (videoUrl && /^https?:\/\//.test(videoUrl)) {
      // Videoni foydalanuvchiga yuborish
      await ctx.replyWithVideo(videoUrl);
    } else {
      ctx.reply("❌ TikTok videosi topilmadi.");
    }
  } catch (error) {
    console.error("TikTok xatosi:", error.message);
    ctx.reply("❌ TikTok videoni yuklab bo‘lmadi.");
  }
};

// --- Telegram Bot Buyruqlari ---

// /start buyrug'ini qabul qilish
bot.start((ctx) =>
  ctx.replyWithHTML(
    "🎬 <b>Video Yuklovchi Botga Xush Kelibsiz!</b>\n\n" +
      "📱 TikTok: <code>https://vm.tiktok.com/...</code>\n" +
      "📺 YouTube: <code>https://youtu.be/...</code>\n\n" +
      "Iltimos, video linkini yuboring."
  )
);

// /help buyrug'ini qabul qilish
bot.help((ctx) =>
  ctx.replyWithHTML(
    "🤖 <b>Yordam</b>\n\n" +
      "1. TikTok link yuboring\n" +
      "2. YouTube link yuboring\n\n" +
      "Bot sizga videoni yuboradi!"
  )
);

// Barcha matn xabarlarini qabul qilish
bot.on("text", async (ctx) => {
  const link = ctx.message.text.trim();

  // '/' bilan boshlanadigan buyruqlarni e'tiborsiz qoldirish
  if (link.startsWith("/")) return;

  // Havola YouTube havolasi ekanligini tekshirish
  if (link.includes("youtube.com") || link.includes("youtu.be")) {
    await downloadYouTubeVideo(link, ctx);
  }
  // Havola TikTok havolasi ekanligini tekshirish
  else if (link.includes("tiktok.com")) {
    await downloadTikTokVideo(link, ctx);
  }
  // Agar ikkalasi ham bo'lmasa, foydalanuvchiga xabar berish
  else {
    ctx.reply("❌ Faqat YouTube yoki TikTok linkini yuboring.");
  }
});

// --- Express Server (Render.com yoki shunga o'xshash hosting uchun) ---
const app = express();
app.get("/", (req, res) => res.send("Bot ishlayapti")); // Serverni faol ushlab turish uchun oddiy endpoint
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});

// --- Botni ishga tushirish va o'chirish ---
bot.launch();
console.log("Telegram bot ishga tushdi.");

// Botni to'xtatish uchun signallarni yoqish
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
