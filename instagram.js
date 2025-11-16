const axios = require("axios")
const fs = require("fs")
const path = require("path")

/**
 * Instagram link dan video/post ID ni ajratib olish
 */
const extractInstagramId = (url) => {
  // Instagram Reels: instagram.com/reel/CODE/
  // Instagram Posts: instagram.com/p/CODE/
  // Instagram TV: instagram.com/tv/CODE/
  const regex = /(?:instagram\.com|instagr\.am)\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/
  const match = url.match(regex)
  return match ? match[1] : null
}

/**
 * Instagram qisqa havolasini to'liq havolaga o'tkazish
 */
const resolveInstagramRedirect = async (shortUrl) => {
  try {
    const response = await axios.head(shortUrl, {
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    })
    return response.request.res.responseUrl || shortUrl
  } catch (error) {
    return error.response?.headers?.location || shortUrl
  }
}

/**
 * Instagram video ma'lumotlarini olish
 */
const getInstagramVideoInfo = async (postId) => {
  try {
    // Instagram public API orqali ma'lumot olish
    const response = await axios.get(
      `https://www.instagram.com/p/${postId}/?__a=1&__d=dis`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      }
    )

    if (response.data && response.data.items && response.data.items[0]) {
      const item = response.data.items[0]
      return {
        title: item.caption?.text?.substring(0, 100) || "Instagram Video",
        author_name: item.user?.username || "Instagram User",
        type: item.media_type === 2 ? "video" : "photo",
      }
    }
  } catch (error) {
    console.log("Instagram ma'lumot olishda xato:", error.message)
  }

  return {
    title: "Instagram Video",
    author_name: "Instagram User",
    type: "video",
  }
}

/**
 * Instagram videoni yuklab olish - Faqat Sizning API ni ishlatadi
 */
const downloadInstagramVideo = async (url, ctx) => {
  try {
    // Qisqa linkni to'liq linkga o'tkazish
    if (url.includes("instagr.am")) {
      url = await resolveInstagramRedirect(url)
    }

    const processingMsg = await ctx.reply("⏳ Instagram videoni yuklab olish boshlandi...")

    // Sizning belgilagan API ni ishlatamiz
    const response = await axios.get("https://instagram-reels-downloader2.p.rapidapi.com/download", {
      params: { url: url, type: "video" },
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_INSTAGRAM_KEY,
        "X-RapidAPI-Host": "instagram-reels-downloader2.p.rapidapi.com",
      },
      timeout: 20000,
    })

    console.log("Instagram API javob:", JSON.stringify(response.data, null, 2))

    // Video URL ni topish
    const videoUrl = response.data?.url || response.data?.download_url || response.data?.video_url

    if (videoUrl && /^https?:\/\//.test(videoUrl)) {
      // Video haqida ma'lumot olish
      const postId = extractInstagramId(url)
      const videoInfo = postId ? await getInstagramVideoInfo(postId) : {
        title: "Instagram Video",
        author_name: "Instagram User"
      }

      // To'g'ridan-to'g'ri video yuborish
      await ctx.replyWithVideo(videoUrl, {
        caption: `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}`,
        parse_mode: "HTML"
      })

      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      console.log("✅ Instagram video muvaffaqiyatli yuborildi")
      return true
    } else {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      ctx.reply("❌ Instagram videosi topilmadi yoki bu post faqat rasm.")
      return false
    }

  } catch (error) {
    console.error("Instagram yuklab olish xatosi:", error.message)
    ctx.reply("❌ Instagram videoni yuklab bo'lmadi.")
    return false
  }
}

module.exports = {
  downloadInstagramVideo,
  extractInstagramId,
  getInstagramVideoInfo,
  resolveInstagramRedirect,
}
