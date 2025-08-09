const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
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
    console.log("🔥 Upload route hit");
    console.log("📦 Files received:", req.files ? req.files.length : 0);
    console.log("📎 Body:", req.body);

    // Handle both single file (req.file) and multiple files (req.files)
    const files = req.files || (req.file ? [req.file] : []);
    
    if (!files || files.length === 0) {
      console.log("❌ No files provided");
      return res.status(400).json({ error: "No files provided" });
    }

    console.log(`📁 Processing ${files.length} files`);

    // Check environment variables
    if (!process.env.S3_BUCKET_NAME) {
      console.error("❌ S3_BUCKET_NAME not configured");
      return res.status(500).json({ error: "Server configuration error: S3_BUCKET_NAME missing" });
    }

    if (!process.env.AWS_REGION) {
      console.error("❌ AWS_REGION not configured");
      return res.status(500).json({ error: "Server configuration error: AWS_REGION missing" });
    }

    // Generate a unique code with retry logic
    let code;
    let attempts = 0;
    const maxAttempts = 5;
    
    console.log("🔄 Generating unique code...");
    
    do {
      try {
        code = generateCode();
        console.log(`🎲 Generated code: ${code}`);
        
        const existingFiles = await File.find({ code });
        console.log(`🔍 Found ${existingFiles.length} existing files with this code`);
        
        if (existingFiles.length === 0) {
          break; // Found a unique code
        }
        attempts++;
        console.log(`🔄 Code ${code} already exists, trying again... (attempt ${attempts})`);
      } catch (codeError) {
        console.error("❌ Error during code generation or check:", codeError);
        throw new Error(`Code generation failed: ${codeError.message}`);
      }
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      console.error("❌ Failed to generate unique code after multiple attempts");
      return res.status(500).json({ error: "Failed to generate unique code after multiple attempts" });
    }

    console.log(`✅ Using unique code: ${code}`);

    const downloadURL = `http://localhost:3000/download/${code}`;
    const expiresAt = new Date(Date.now() + (process.env.URL_EXPIRY || 3600) * 1000);
    
    const uploadedFiles = [];
    const s3UploadPromises = [];
    
    console.log("☁️ Starting S3 uploads...");
    
    // Upload all files to S3 first
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { originalname, buffer, mimetype, size } = file;
      
      if (!buffer || buffer.length === 0) {
        console.error(`❌ File ${originalname} has no content`);
        continue;
      }
      
      const s3Key = `uploads/${code}-${Date.now()}-${i}-${originalname}`;
      console.log(`📤 Uploading ${originalname} to S3 with key: ${s3Key}`);

      const uploadPromise = s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: mimetype,
      })).then(() => {
        console.log(`✅ Uploaded to S3: ${originalname}`);
        return {
          s3Key,
          filename: originalname,
          mimeType: mimetype,
          fileSize: size,
          batchIndex: i
        };
      }).catch((s3Error) => {
        console.error(`❌ S3 upload failed for ${originalname}:`, s3Error);
        throw new Error(`S3 upload failed for ${originalname}: ${s3Error.message}`);
      });

      s3UploadPromises.push(uploadPromise);
      
      uploadedFiles.push({
        filename: originalname,
        size: size,
        mimeType: mimetype
      });
    }

    if (s3UploadPromises.length === 0) {
      console.error("❌ No valid files to upload");
      return res.status(400).json({ error: "No valid files to upload" });
    }

    // Wait for all S3 uploads to complete
    console.log("⏳ Waiting for S3 uploads to complete...");
    const s3Results = await Promise.all(s3UploadPromises);
    console.log(`✅ All ${s3Results.length} files uploaded to S3`);

    // Now save metadata to database - try to save all files even if some fail
    console.log("💾 Saving file metadata to database...");
    
    let savedCount = 0;
    const savePromises = s3Results.map(async (fileData, index) => {
      try {
        // Check if this exact file already exists (shouldn't happen but just in case)
        const existingFile = await File.findOne({ 
          code: code, 
          filename: fileData.filename, 
          batchIndex: fileData.batchIndex 
        });
        
        if (existingFile) {
          console.log(`⚠️ File ${fileData.filename} already exists in DB, skipping`);
          return;
        }

        await File.create({
          code,
          s3Key: fileData.s3Key,
          filename: fileData.filename,
          mimeType: fileData.mimeType,
          fileSize: fileData.fileSize,
          expiresAt,
          batchIndex: fileData.batchIndex
        });
        
        console.log(`✅ Saved to DB: ${fileData.filename}`);
        savedCount++;
      } catch (dbError) {
        console.error(`❌ Failed to save ${fileData.filename} to DB:`, dbError);
        
        // Try an alternative approach - create without the problematic fields
        try {
          await File.collection.insertOne({
            code,
            s3Key: fileData.s3Key,
            filename: fileData.filename,
            mimeType: fileData.mimeType,
            fileSize: fileData.fileSize,
            expiresAt,
            batchIndex: fileData.batchIndex,
            isDownloaded: false,
            uploadedAt: new Date()
          });
          console.log(`✅ Saved to DB (alternative method): ${fileData.filename}`);
          savedCount++;
        } catch (altError) {
          console.error(`❌ Alternative save also failed for ${fileData.filename}:`, altError);
        }
      }
    });

    // Wait for all database saves to complete
    await Promise.allSettled(savePromises);
    console.log(`💾 Database save completed. ${savedCount}/${s3Results.length} files saved to DB`);

    // Verify what actually got saved
    const actualSavedFiles = await File.find({ code }).sort({ batchIndex: 1 });
    console.log(`🔍 Verification: Found ${actualSavedFiles.length} files in DB with code ${code}`);

    console.log("🎨 Generating QR code...");
    const qrCode = await QRCode.toDataURL(downloadURL);
    console.log("✅ QR code generated");

    const response = {
      code, 
      qrCode, 
      downloadURL, 
      filesCount: files.length,
      filesSavedToDb: actualSavedFiles.length,
      files: uploadedFiles 
    };

    console.log("🎉 Upload completed successfully");
    res.json(response);
    
  } catch (err) {
    console.error("❌ Upload error:", err);
    console.error("❌ Error stack:", err.stack);
    
    // Send more detailed error information
    const errorResponse = {
      error: "Upload failed",
      details: err.message,
      type: err.name || "UnknownError"
    };
    
    console.log("📤 Sending error response:", errorResponse);
    res.status(500).json(errorResponse);
  }
};

const getDownloadLink = async (req, res) => {
  try {
    console.log(`🔍 Fetching files for code: ${req.params.code}`);
    
    // Find all files with the same code
    const files = await File.find({ code: req.params.code }).sort({ batchIndex: 1 });

    console.log(`📁 Found ${files.length} files for code: ${req.params.code}`);

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "Invalid code or no files found" });
    }

    // Check if any file is expired or already downloaded
    const now = new Date();
    if (files.some(file => file.isDownloaded || file.expiresAt < now)) {
      return res.status(410).json({ error: "Link expired or already used" });
    }

    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    
    // Generate download URLs for all files
    const downloadData = [];
    
    for (const file of files) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: file.s3Key,
        });

        // Use a longer expiry time for the signed URL (1 hour)
        const url = await getSignedUrl(s3, command, {
          expiresIn: 3600, // 1 hour
        });

        downloadData.push({
          filename: file.filename,
          downloadUrl: url,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          batchIndex: file.batchIndex
        });

        console.log(`✅ Generated download URL for: ${file.filename}`);
      } catch (urlError) {
        console.error(`❌ Error generating URL for ${file.filename}:`, urlError);
        // Continue with other files even if one fails
      }
    }

    if (downloadData.length === 0) {
      return res.status(500).json({ error: "Failed to generate download URLs for any files" });
    }

    // Mark all files as downloaded
    await File.updateMany({ code: req.params.code }, { isDownloaded: true });

    res.json({ 
      files: downloadData,
      filesCount: files.length,
      totalSize: files.reduce((sum, file) => sum + (file.fileSize || 0), 0)
    });
  } catch (err) {
    console.error("❌ Download error:", err);
    res.status(500).json({ error: "Failed to generate download URLs", details: err.message });
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
