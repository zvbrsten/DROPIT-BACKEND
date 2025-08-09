const express = require("express");
const multer = require("multer");
const router = express.Router();
const fileController = require("../controllers/fileController");

const upload = multer(); // uses memory storage

// Health check endpoint
router.get("/health", (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: {
      s3BucketConfigured: !!process.env.S3_BUCKET_NAME,
      awsRegionConfigured: !!process.env.AWS_REGION,
      mongoUriConfigured: !!process.env.MONGODB_URI,
      urlExpiryConfigured: !!process.env.URL_EXPIRY
    }
  };
  
  console.log("🏥 Health check:", healthCheck);
  res.json(healthCheck);
});

// Support both single and multiple file uploads
router.post("/upload", upload.array("files", 10), fileController.uploadFile); // Allow up to 10 files
router.get("/file/:code", fileController.getDownloadLink);

module.exports = router;
