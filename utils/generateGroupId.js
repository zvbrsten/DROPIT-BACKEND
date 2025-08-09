const crypto = require("crypto");

function generateGroupId(length = 6) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

module.exports = generateGroupId;
