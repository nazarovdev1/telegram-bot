// # KEEP-ALIVE SYSTEM FOR TELEGRAM BOT
// # Place this ping endpoint in your bot.js file (in the Express section)

// # Add this endpoint after the /status endpoint in bot.js:
app.get("/ping", (req, res) => {
  updateActivity()
  res.json({ 
    status: "alive", 
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    hosting: isHosting,
    ping: "pong"
  })
})
