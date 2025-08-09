const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  groupId: { type: String, unique: true },
  name: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Group", groupSchema);
