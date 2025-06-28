const express = require("express");
const multer = require("multer");
const router = express.Router();
const fileController = require("../controllers/fileController");

const upload = multer(); // uses memory storage

router.post("/upload", upload.single("file"), fileController.uploadFile);
router.get("/file/:code", fileController.getDownloadLink);

module.exports = router;
