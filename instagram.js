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
 * Instagram videoni yuklab olish - HOSTING AWARE
 */
const downloadInstagramVideo = async (url, ctx, isHosting = false) => {
  try {
    // Qisqa linkni to'liq linkga o'tkazish
    if (url.includes("instagr.am")) {
      url = await resolveInstagramRedirect(url)
    }

    const processingMsg = await ctx.reply("⏳ Instagram videoni yuklab olish boshlandi...")

    // Instagram video ID ni olish
    const postId = extractInstagramId(url)
    if (!postId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      return ctx.reply("❌ Instagram video ID topilmadi.")
    }

    console.log("Instagram post ID:", postId)

    // Yangi RapidAPI orqali video yuklab olish (user tomonidan berilgan)
    try {
      const response = await axios.get(
        "https://instagram-reels-downloader-api.p.rapidapi.com/download",
        {
          params: { url: url, type: "video" },
          headers: {
            "X-RapidAPI-Key": process.env.RAPIDAPI_INSTAGRAM_KEY,
            "X-RapidAPI-Host": "instagram-reels-downloader-api.p.rapidapi.com",
          },
          timeout: isHosting ? 15000 : 20000,
        }
      )

      console.log("Instagram API javob:", JSON.stringify(response.data, null, 2))

      // Video URL ni topish (yangi API uchun)
      let videoUrl = null

      // Direct URLs
      if (response.data?.download_url) {
        videoUrl = response.data.download_url
      } else if (response.data?.video_url) {
        videoUrl = response.data.video_url
      } else if (response.data?.url) {
        videoUrl = response.data.url
      }
      // Yangi API format uchun (data.medias)
      else if (response.data?.data?.medias) {
        const medias = response.data.data.medias
        const videoMedia = medias.find(media => media.type === 'video')
        if (videoMedia && videoMedia.url) {
          videoUrl = videoMedia.url
        }
      }
      // Eski format uchun (data ichida)
      else if (response.data?.data) {
        const data = response.data.data

        if (data.video_url) {
          videoUrl = data.video_url
        }
        // Carousel yoki boshqa formatlar uchun
        else if (data.carousel_media && data.carousel_media.length > 0) {
          const videoItem = data.carousel_media.find(item => item.video_url)
          if (videoItem) {
            videoUrl = videoItem.video_url
          }
        }
        // Video versions uchun
        else if (data.video_versions && data.video_versions.length > 0) {
          videoUrl = data.video_versions[0].url
        }
      }

      if (videoUrl && /^https?:\/\//.test(videoUrl)) {
        const videoInfo = await getInstagramVideoInfo(postId)

        if (isHosting) {
          // HOSTING: Link yuborish
          await ctx.replyWithHTML(
            `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}\n\n` +
            `📥 Video yuklab olish uchun quyidagi havolani oching:\n\n` +
            `<a href="${videoUrl}">📺 Instagram Video yuklab olish</a>\n\n` +
            `⚠️ <i>Hosting muhitida to'g'ridan-to'g'ri yuborish cheklangan</i>`,
            { disable_web_page_preview: true }
          )
        } else {
          // LOCAL: To'g'ridan-to'g'ri yuborish
          await ctx.replyWithVideo(videoUrl, {
            caption: `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}`,
            parse_mode: "HTML"
          })
        }

        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
        console.log("✅ Instagram video muvaffaqiyatli yuborildi")
        return true
      } else {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
        ctx.reply("❌ Instagram videosi topilmadi yoki bu post faqat rasm.")
        return false
      }

    } catch (apiError) {
      console.error("Instagram API xatosi:", apiError.message)

      // Alternatif API - Instagram Media Downloader
      try {
        console.log("Alternatif Instagram API ishlatilmoqda...")

        const altResponse = await axios.get(
          "https://instagram-media-downloader.p.rapidapi.com/v1/post_info",
          {
            params: { url: url },
            headers: {
              "X-RapidAPI-Key": process.env.RAPIDAPI_INSTAGRAM_KEY,
              "X-RapidAPI-Host": "instagram-media-downloader.p.rapidapi.com",
            },
            timeout: isHosting ? 15000 : 20000,
          }
        )

        console.log("Alternatif API javob:", JSON.stringify(altResponse.data, null, 2))

        // Alternative API uchun turli formatlarni tekshirish
        let videoUrl = null
        const data = altResponse.data?.data

        if (data) {
          // Reels uchun
          if (data.video_url) {
            videoUrl = data.video_url
          }
          // Carousel yoki boshqa formatlar uchun
          else if (data.carousel_media && data.carousel_media.length > 0) {
            const videoItem = data.carousel_media.find(item => item.video_url)
            if (videoItem) {
              videoUrl = videoItem.video_url
            }
          }
          // Video versions uchun
          else if (data.video_versions && data.video_versions.length > 0) {
            videoUrl = data.video_versions[0].url
          }
        }

        if (videoUrl && /^https?:\/\//.test(videoUrl)) {
          const videoInfo = await getInstagramVideoInfo(postId)

          if (isHosting) {
            await ctx.replyWithHTML(
              `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}\n\n` +
              `📥 Video yuklab olish uchun quyidagi havolani oching:\n\n` +
              `<a href="${videoUrl}">📺 Instagram Video yuklab olish</a>\n\n` +
              `⚠️ <i>Hosting muhitida to'g'ridan-to'g'ri yuborish cheklangan</i>`,
              { disable_web_page_preview: true }
            )
          } else {
            await ctx.replyWithVideo(videoUrl, {
              caption: `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}`,
              parse_mode: "HTML"
            })
          }

          await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
          console.log("✅ Instagram video alternatif API orqali yuborildi")
          return true
        }

      } catch (altError) {
        console.error("Alternatif Instagram API ham ishlamadi:", altError.message)

        // Ikkinchi alternativa API
        try {
          console.log("Ikkinchi alternatif Instagram API ishlatilmoqda...")

          const altResponse2 = await axios.get(
            "https://instagram-reels-and-highlights-downloader.p.rapidapi.com/v1/post_info",
            {
              params: { url: url },
              headers: {
                "X-RapidAPI-Key": process.env.RAPIDAPI_INSTAGRAM_KEY,
                "X-RapidAPI-Host": "instagram-reels-and-highlights-downloader.p.rapidapi.com",
              },
              timeout: isHosting ? 15000 : 20000,
            }
          )

          console.log("Ikkinchi API javob:", JSON.stringify(altResponse2.data, null, 2))

          // Alternative API uchun turli formatlarni tekshirish
          let videoUrl = null
          if (altResponse2.data?.download_url) {
            videoUrl = altResponse2.data.download_url
          } else if (altResponse2.data?.video_url) {
            videoUrl = altResponse2.data.video_url
          } else if (altResponse2.data?.media_url) {
            videoUrl = altResponse2.data.media_url
          } else if (altResponse2.data?.url) {
            videoUrl = altResponse2.data.url
          }

          if (videoUrl && /^https?:\/\//.test(videoUrl)) {
            const videoInfo = await getInstagramVideoInfo(postId)

            if (isHosting) {
              await ctx.replyWithHTML(
                `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}\n\n` +
                `📥 Video yuklab olish uchun quyidagi havolani oching:\n\n` +
                `<a href="${videoUrl}">📺 Instagram Video yuklab olish</a>\n\n` +
                `⚠️ <i>Hosting muhitida to'g'ridan-to'g'ri yuborish cheklangan</i>`,
                { disable_web_page_preview: true }
              )
            } else {
              await ctx.replyWithVideo(videoUrl, {
                caption: `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}`,
                parse_mode: "HTML"
              })
            }

            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
            console.log("✅ Instagram video 2-alt API orqali yuborildi")
            return true
          }

        } catch (alt2Error) {
          console.error("Ikkinchi alternativa API ham ishlamadi:", alt2Error.message)

          // Uchinchi API - Final fallback
          try {
            console.log("Uchinchi Instagram API ishlatilmoqda...")

            const finalResponse = await axios.get(
              "https://instagram-downloader.mixcode.repl.co/download",
              {
                params: { url: url },
                timeout: isHosting ? 15000 : 20000,
              }
            )

            console.log("Uchinchi API javob:", JSON.stringify(finalResponse.data, null, 2))

            let videoUrl = finalResponse.data?.download_url ||
                           finalResponse.data?.video_url ||
                           finalResponse.data?.media_url ||
                           finalResponse.data?.url

            if (videoUrl && /^https?:\/\//.test(videoUrl)) {
              const videoInfo = await getInstagramVideoInfo(postId)

              if (isHosting) {
                await ctx.replyWithHTML(
                  `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}\n\n` +
                  `📥 Video yuklab olish uchun quyidagi havolani oching:\n\n` +
                  `<a href="${videoUrl}">📺 Instagram Video yuklab olish</a>\n\n` +
                  `⚠️ <i>Uchinchi API orqali (hosting uyumlu)</i>`,
                  { disable_web_page_preview: true }
                )
              } else {
                await ctx.replyWithVideo(videoUrl, {
                  caption: `📸 <b>${videoInfo.title}</b>\n👤 @${videoInfo.author_name}`,
                  parse_mode: "HTML"
                })
              }

              await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
              console.log("✅ Instagram video uchinchi API orqali yuborildi")
              return true
            }

          } catch (finalError) {
            console.error("Uchinchi Instagram API ham ishlamadi:", finalError.message)
          }
        }
      }

      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id)
      ctx.reply("Iltimos yana urinib ko'ring yoki birozdan keyin urinib ko'ring")
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
