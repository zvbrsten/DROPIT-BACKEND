const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // use memory storage

const {
  createGroup,
  getGroup,
  uploadToGroup,
} = require("../controllers/groupController");

router.post("/create", createGroup);
router.get("/:groupId", getGroup);
router.get("/:groupId/files", getGroup); // Alias for getting group files
router.post("/:groupId/upload", upload.single("file"), uploadToGroup);

module.exports = router;
