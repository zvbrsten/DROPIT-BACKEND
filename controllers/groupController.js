const Group = require("../models/Group");
const File = require("../models/File");
const generateGroupId = require("../utils/generateGroupId");
const generateCode = require("../utils/generateCode");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const groupId = generateGroupId();

    const group = new Group({ name, groupId });
    await group.save();

    res.status(201).json(group);
  } catch (err) {
    console.error("Group creation error:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
};

exports.getGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Find the group
    const group = await Group.findOne({ groupId });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Get all files in this group
    const files = await File.find({ groupId }).sort({ uploadedAt: -1 });
    
    res.json({
      group,
      files: files.map(file => ({
        filename: file.filename,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        uploadedAt: file.uploadedAt,
        code: file.code
      }))
    });
  } catch (err) {
    console.error("Get group error:", err);
    res.status(500).json({ error: "Failed to get group" });
  }
};

exports.uploadToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Check if group exists
    const group = await Group.findOne({ groupId });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { originalname, buffer, mimetype, size } = req.file;
    const code = generateCode();
    const s3Key = `groups/${groupId}/${Date.now()}-${originalname}`;

    // Upload to S3
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: mimetype,
    }));

    // Save file metadata to database
    const file = await File.create({ 
      code, 
      s3Key, 
      filename: originalname, 
      mimeType: mimetype, 
      fileSize: size,
      groupId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days for group files
    });

    res.json({
      message: "File uploaded successfully",
      file: {
        filename: originalname,
        size: size,
        mimeType: mimetype,
        code: code
      }
    });
  } catch (err) {
    console.error("Group upload error:", err);
    res.status(500).json({ error: "Failed to upload file" });
  }
};
