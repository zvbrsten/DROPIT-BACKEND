const app = require("./app");
const fileController = require("./controllers/fileController");

// Export the Express app so Vercel can handle it
module.exports = app;

// Optional: expose a manual cleanup endpoint instead of using node-cron
// This way, you can hit this route with an external scheduler like GitHub Actions or cron-job.org
app.get("/api/cleanup", async (req, res) => {
  try {
    await fileController.deleteExpiredFiles();
    res.status(200).json({ message: "Expired files deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete expired files" });
  }
});
