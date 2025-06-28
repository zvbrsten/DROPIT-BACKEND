const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  s3Key: String,
  filename: String,
  mimeType: String,
  isDownloaded: { type: Boolean, default: false },
  expiresAt: Date,
});

module.exports = mongoose.model("File", fileSchema);
