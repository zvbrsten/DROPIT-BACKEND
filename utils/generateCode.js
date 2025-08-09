const crypto = require("crypto");

const generateCode = () => {
  // Generate a 10-character code using hex characters (0-9, a-f)
  const characters = '1234567890abcdef';
  let result = '';
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    result += characters[randomIndex];
  }
  
  return result;
};

module.exports = generateCode;