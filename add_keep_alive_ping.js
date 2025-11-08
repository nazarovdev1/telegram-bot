// PING ENDPOINT FOR KEEP-ALIVE
// Add this to your bot.js file in the Express section

// Add this endpoint in the Express section of bot.js (around line 600-700)
app.get("/ping", (req, res) => {
  res.json({ 
    status: "alive", 
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    hosting: isHosting,
    ping: "pong"
  })
})
