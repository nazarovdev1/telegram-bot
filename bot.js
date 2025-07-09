// const { Telegraf } = require("telegraf");
// const axios = require("axios");

// const bot = new Telegraf("7878015755:AAFhNg_aY25FxaXKEGSzHUGOcaa5_Zi_RIM"); // o‘zingizning token

// const resolveRedirect = async (shortUrl) => {
//   try {
//     const response = await axios.head(shortUrl, {
//       maxRedirects: 0,
//       validateStatus: (status) => status >= 200 && status < 400
//     });
    
//     if (response.headers.location) {
//       return response.headers.location;
//     }
//     return shortUrl;
//   } catch (error) {
//     if (error.response && error.response.headers.location) {
//       return error.response.headers.location;
//     }
//     console.error("Redirect error:", error.message);
//     return shortUrl;
//   }
// };

// bot.start((ctx) => ctx.reply("🎬 TikTok link yuboring."));

// bot.on("text", async (ctx) => {
//   let link = ctx.message.text.trim();

//   // Skip processing if it's a command
//   if (link.startsWith('/')) return;

//   if (link.includes("tiktok.com")) {
//     if (link.includes("vt.tiktok.com") || link.includes("vm.tiktok.com")) {
//       try {
//         link = await resolveRedirect(link);
//         console.log("🔗 To‘liq TikTok link:", link);
//       } catch (e) {
//         console.error("Redirect error:", e.message);
//         return ctx.reply("⚠️ Redirectda xatolik. Linkni tekshirib qayta urinib ko'ring.");
//       }
//     }

//     try {
//       const response = await axios.get("https://tiktok-video-no-watermark2.p.rapidapi.com/", {
//         params: { url: link, hd: 1 },
//         headers: {
//           'X-RapidAPI-Key': '55c1142c8dmshe3642fb6859f937p104c2ejsnac67748d4751',
//           'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
//         },
//         timeout: 10000
//       });

//       console.log("API Response:", response.data);

//       // Extract video URL from different possible response structures
//       const videoUrl = 
//         response.data?.data?.play || 
//         response.data?.data?.hdplay || 
//         response.data?.data?.download_addr || 
//         response.data?.video || 
//         response.data?.url;

//       console.log("🎥 Video URL:", videoUrl);

//       if (videoUrl && /^https?:\/\//.test(videoUrl)) {
//         await ctx.replyWithVideo(videoUrl);
//       } else {
//         ctx.reply("❌ Video topilmadi. API javobi o'zgarganga o'xshaydi.");
//       }
//     } catch (error) {
//       console.error("❌ API xatolik:", error.response?.data || error.message);
//       ctx.reply("⚠️ Yuklab bo‘lmadi. API ishlamayapti yoki noto‘g‘ri link.");
//     }
//   } else {
//     ctx.reply("Iltimos, faqat TikTok link yuboring (tiktok.com, vt.tiktok.com, vm.tiktok.com).");
//   }
// });

// bot.launch();

// // Handle process termination gracefully
// process.once('SIGINT', () => bot.stop('SIGINT'));
// process.once('SIGTERM', () => bot.stop('SIGTERM'));
const { Telegraf } = require("telegraf");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ytdlp = require("yt-dlp-exec");


const bot = new Telegraf("7878015755:AAFhNg_aY25FxaXKEGSzHUGOcaa5_Zi_RIM"); // <-- TOKENINGIZNI BU YERGA QO'YING

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Qisqa TikTok linkini to‘liq linkka aylantirish
const resolveRedirect = async (shortUrl) => {
  try {
    const response = await axios.head(shortUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    return response.headers.location || shortUrl;
  } catch (error) {
    if (error.response?.headers?.location) return error.response.headers.location;
    return shortUrl;
  }
};

// YouTube videoni yuklab olish
const downloadYouTubeVideo = async (url, ctx) => {
  try {
    const processingMsg = await ctx.reply("⏳ YouTube videoni yuklab olish jarayoni boshlandi...");
    const outputPath = path.join(tempDir, `${Date.now()}.mp4`);

    await ytdlp(url, {
      output: outputPath,
      format: "best[ext=mp4]/best",
    });

    if (!fs.existsSync(outputPath)) {
      return ctx.reply("❌ Yuklab olingan fayl topilmadi.");
    }

    await ctx.replyWithVideo({ source: outputPath });
    fs.unlinkSync(outputPath);
    ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);

  } catch (error) {
    console.error("YouTube xatosi:", error.message);
    ctx.reply("❌ YouTube videoni yuklab bo‘lmadi.");
  }
};

// TikTok videoni yuklash
const downloadTikTokVideo = async (url, ctx) => {
  try {
    if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
      url = await resolveRedirect(url);
    }

    const response = await axios.get("https://tiktok-video-no-watermark2.p.rapidapi.com/", {
      params: { url, hd: 1 },
      headers: {
        'X-RapidAPI-Key': '55c1142c8dmshe3642fb6859f937p104c2ejsnac67748d4751', // <-- BU YERGA RapidAPI kalitingizni yozing
        'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
      },
      timeout: 10000
    });

    const videoUrl = response.data?.data?.play || response.data?.data?.hdplay;
    if (videoUrl && /^https?:\/\//.test(videoUrl)) {
      await ctx.replyWithVideo(videoUrl);
    } else {
      ctx.reply("❌ TikTok videosi topilmadi.");
    }
  } catch (error) {
    console.error("TikTok xatosi:", error.message);
    ctx.reply("❌ TikTok videoni yuklab bo‘lmadi.");
  }
};

// Start / Help komandasi
bot.start((ctx) => ctx.replyWithHTML(
  "🎬 <b>Video Yuklovchi Botga Xush Kelibsiz!</b>\n\n" +
  "📱 TikTok: <code>https://vm.tiktok.com/...</code>\n" +
  "📺 YouTube: <code>https://youtu.be/...</code>\n\n" +
  "Iltimos, video linkini yuboring."
));

bot.help((ctx) => ctx.replyWithHTML(
  "🤖 <b>Yordam</b>\n\n" +
  "Bot quyidagi platformalardan video yuklaydi:\n" +
  "1. TikTok\n" +
  "2. YouTube\n\n" +
  "Video linkini yuboring va kuting."
));

// Matnli xabarni qabul qilish
bot.on("text", async (ctx) => {
  const link = ctx.message.text.trim();

  if (link.startsWith("/")) return;

  if (link.includes("youtube.com") || link.includes("youtu.be")) {
    await downloadYouTubeVideo(link, ctx);
  } else if (link.includes("tiktok.com")) {
    await downloadTikTokVideo(link, ctx);
  } else {
    ctx.reply("❌ Iltimos, YouTube yoki TikTok video linkini yuboring.");
  }
});
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot ishlayapti"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Server ishga tushdi");
});

bot.start((ctx) => ctx.reply("Salom!"));

bot.launch();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
