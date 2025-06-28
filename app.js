const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: "https://dropit-sepia.vercel.app/", // 🔁 Replace with your actual frontend URL
    credentials: true, // optional, only if you use cookies or auth headers
  })
);
app.use(express.json());

// ✅ Clean MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.use("/api", require("./routes/fileRoutes"));

module.exports = app;
