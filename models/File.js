const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  code: { type: String, sparse: true }, // removed unique constraint to allow multiple files per code
  s3Key: String,
  filename: String,
  mimeType: String,
  fileSize: Number, // add file size tracking
  isDownloaded: { type: Boolean, default: false },
  expiresAt: Date,
  groupId: { type: String, default: null },
  uploadedAt: { type: Date, default: Date.now },
  batchIndex: { type: Number, default: 0 }, // to maintain order of files in a batch
});

// Create compound index for code and batchIndex for efficient querying
fileSchema.index({ code: 1, batchIndex: 1 });

module.exports = mongoose.model("File", fileSchema);
