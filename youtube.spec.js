const { test, expect } = require("@playwright/test")
const axios = require("axios")
const { downloadYouTubeVideo } = require("./youtube")

test("downloadYouTubeVideo sends cobalt response", async () => {
  const originalPost = axios.post
  const originalGet = axios.get
  let videoCall = null
  let deleteCall = null
  const replyMessages = []

  axios.post = async (url) => {
    if (url === "https://api.cobalt.tools/api/json") {
      return { data: { url: "https://cdn.test/video.mp4" } }
    }
    return { data: {} }
  }

  axios.get = async () => {
    throw new Error("Unexpected axios.get call")
  }

  const ctx = {
    chat: { id: 1 },
    reply: async (text) => {
      replyMessages.push(text)
      return { message_id: 10 }
    },
    replyWithVideo: async (videoUrl, options) => {
      videoCall = { videoUrl, caption: options.caption }
    },
    replyWithHTML: async () => {},
    telegram: {
      deleteMessage: async (chatId, messageId) => {
        deleteCall = { chatId, messageId }
      },
    },
  }

  try {
    await downloadYouTubeVideo("https://youtu.be/abcdefghijk", ctx)
    expect(replyMessages[0]).toBe("⏳ YouTube videoni yuklab olish boshlandi...")
    expect(videoCall).toEqual({
      videoUrl: "https://cdn.test/video.mp4",
      caption: "🎬 YouTube Video",
    })
    expect(deleteCall).toEqual({ chatId: 1, messageId: 10 })
  } finally {
    axios.post = originalPost
    axios.get = originalGet
  }
})
