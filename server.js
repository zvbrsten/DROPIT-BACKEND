const app = require("./app");
const cron = require("node-cron");
const fileController = require("./controllers/fileController");

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Auto-cleanup every 15 minutes
cron.schedule("*/15 * * * *", fileController.deleteExpiredFiles);
