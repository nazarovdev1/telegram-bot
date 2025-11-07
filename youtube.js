const axios = require("axios")
const fs = require("fs")
const path = require("path")

const extractYouTubeId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

const getYouTubeVideoInfo = async (videoId) => {
  try {
    const response = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    )
    return {
      title: response.data.title,
      author_name: response.data.author_name,
      duration: "N/A",
      views: "N/A",
    }
  } catch (error) {
    return {
      title: "Noma'lum video",
      author_name: "Noma'lum",
      duration: "N/A",
      views: "N/A",
    }
  }
}

const downloadYouTubeVideo = async (url, ctx) => {
  const processingMsg = await ctx.reply("⏳ YouTube videoni yuklab olish boshlandi...")

  const videoId = extractYouTubeId(url)
  if (!videoId) {
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
    return ctx.reply("❌ YouTube video ID topilmadi.")
  }

  try {
    // RapidAPI YouTube downloader xizmatidan foydalanish
    console.log("YouTube videosi ma'lumotlarini olish boshlandi...")

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

    const videoData = response.data
    console.log("YouTube API javob:", JSON.stringify(videoData, null, 2))

    // API javobida videolar videos.items ichida joylashgan
    if (videoData && videoData.videos && videoData.videos.items && videoData.videos.items.length > 0) {
      // Eng yaxshi sifatdagi videoni topish
      const videoFormats = videoData.videos.items
        .filter(v => v.url && v.quality && v.extension === "mp4" && v.hasAudio) // Faqat audio bo'lgan videolarni
        .sort((a, b) => {
          const aHeight = parseInt(a.quality.replace("p", ""))
          const bHeight = parseInt(b.quality.replace("p", ""))
          return bHeight - aHeight
        })

      if (videoFormats.length > 0) {
        const bestVideo = videoFormats[0] // Eng yuqori sifat
        const videoInfo = await getYouTubeVideoInfo(videoId)
        
        console.log("Topilgan video:", bestVideo.quality, bestVideo.size)
        
        // Video ma'lumotlarini yuborish
        await ctx.replyWithVideo(bestVideo.url, {
          caption: `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n📊 Sifat: ${bestVideo.quality}\n📁 Hajmi: ${bestVideo.size}`,
          parse_mode: "HTML"
        })
        
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
        console.log("YouTube video muvaffaqiyatli yuborildi")
        return
      }
    }

    // Agar video topilmasa, xato xabari
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
    ctx.reply("❌ YouTube videosi topilmadi yoki yuklab bo'lmadi.")
    
  } catch (error) {
    console.error("YouTube API xatosi:", error.message)
    
    // API ishlamasa, yt-dlp yordamida
    try {
      console.log("API ishlamadi, yt-dlp yordamida...")
      
      // Vaqtinchalik fayl nomini yaratish
      const tempFileName = `youtube_${videoId}_${Date.now()}.mp4`
      const tempFilePath = path.join(__dirname, "temp", tempFileName)
      
      const { spawn } = require("child_process")
      const args = [
        "-f", "best[height<=720]", // 720p gacha eng yaxshi sifat
        "-o", tempFilePath,
        url
      ]

      console.log("YouTube videoni yt-dlp orqali yuklab olish boshlandi...")

      const ytDlp = spawn(path.join(__dirname, "bin", "yt-dlp.exe"), args)

      let stderr = ""

      ytDlp.stderr.on("data", (data) => {
        stderr += data.toString()
        console.log("yt-dlp xatosi:", data.toString().trim())
      })

      ytDlp.on("close", async (code) => {
        if (code === 0 && fs.existsSync(tempFilePath)) {
          try {
            const videoInfo = await getYouTubeVideoInfo(videoId)
            const videoStream = fs.createReadStream(tempFilePath)
            
            await ctx.replyWithVideo(
              { source: videoStream },
              {
                caption: `🎬 <b>${videoInfo.title}</b>\n👤 ${videoInfo.author_name}\n🔄 yt-dlp orqali yuklab olingan`,
                parse_mode: "HTML"
              }
            )
            
            fs.unlinkSync(tempFilePath)
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
            console.log("YouTube video yt-dlp orqali muvaffaqiyatli yuborildi")
            
          } catch (sendError) {
            console.error("yt-dlp video yuborishda xato:", sendError.message)
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
            ctx.reply("❌ Video yuborishda xato yuz berdi.")
            
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath)
            }
          }
        } else {
          console.error("yt-dlp video yuklab olishda xato:", stderr)
          await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
          ctx.reply("❌ YouTube videoni yuklab bo'lmadi. Iltimos, qayta urinib ko'ring.")
          
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath)
          }
        }
      })

    } catch (ytdlpError) {
      console.error("yt-dlp ham ishlamadi:", ytdlpError.message)
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      ctx.reply("❌ YouTube videoni yuklab bo'lmadi. Barcha usullar sinab ko'rildi.")
    }
  }
}

module.exports = {
  downloadYouTubeVideo,
  extractYouTubeId,
  getYouTubeVideoInfo,
}
