const crypto = require("crypto");

function generateCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g., "A1B2C3"
}

module.exports = generateCode;
