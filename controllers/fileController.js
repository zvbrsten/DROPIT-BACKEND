const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const File = require("../models/File");
const generateCode = require("../utils/generateCode");
const QRCode = require("qrcode");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { originalname, buffer, mimetype } = req.file;
    const code = generateCode();
    const s3Key = `uploads/${Date.now()}-${originalname}`;

    // Upload to S3
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: mimetype,
    }));

    const expiresAt = new Date(Date.now() + parseInt(process.env.URL_EXPIRY) * 1000);

    // Save in DB
    await File.create({ code, s3Key, filename: originalname, mimeType: mimetype, expiresAt });

    // Generate Signed URL now for QR code
    const signedCommand = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3, signedCommand, {
      expiresIn: parseInt(process.env.URL_EXPIRY),
    });

    // Use S3 signed URL for QR code
    const qrCode = await QRCode.toDataURL(signedUrl);

    res.json({ code, qrCode, downloadURL: signedUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
};



const getDownloadLink = async (req, res) => {
  try {
    const file = await File.findOne({ code: req.params.code });

    if (!file) return res.status(404).json({ error: "Invalid code" });
    if (file.isDownloaded || file.expiresAt < new Date()) {
      return res.status(410).json({ error: "Link expired or already used" });
    }

    const { GetObjectCommand } = require("@aws-sdk/client-s3");

    const command = new GetObjectCommand({  // ✅ use this
      Bucket: process.env.S3_BUCKET_NAME,
      Key: file.s3Key,
    });

    const url = await getSignedUrl(s3, command, {
      expiresIn: parseInt(process.env.URL_EXPIRY),
    });

    file.isDownloaded = true;
    await file.save();

    res.json({ downloadUrl: url, filename: file.filename });
  } catch (err) {
    console.error("❌ Download error:", err);
    res.status(500).json({ error: "Failed to generate download URL", details: err.message });
  }
};

const deleteExpiredFiles = async () => {
  const expired = await File.find({
    $or: [{ isDownloaded: true }, { expiresAt: { $lt: new Date() } }],
  });

  for (const file of expired) {
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.s3Key,
      }));
      await File.deleteOne({ _id: file._id });
    } catch (err) {
      console.error("Failed to delete:", file.code, err.message);
    }
  }
};

module.exports = { uploadFile, getDownloadLink, deleteExpiredFiles };
