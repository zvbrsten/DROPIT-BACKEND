const mongoose = require("mongoose");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

async function testConnections() {
  console.log("🧪 Testing connections...\n");

  // Test environment variables
  console.log("📋 Environment Variables:");
  console.log(`  MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}`);
  console.log(`  S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME ? '✅ Set' : '❌ Missing'}`);
  console.log(`  AWS_REGION: ${process.env.AWS_REGION ? '✅ Set' : '❌ Missing'}`);
  console.log(`  AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`  AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  URL_EXPIRY: ${process.env.URL_EXPIRY || '3600 (default)'}\n`);

  // Test MongoDB connection
  try {
    console.log("🔗 Testing MongoDB connection...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected successfully");

    // Test database operations
    const db = mongoose.connection.db;
    const filesCollection = db.collection('files');
    
    // Count existing files
    const fileCount = await filesCollection.countDocuments();
    console.log(`📊 Current files in database: ${fileCount}`);
    
    // List indexes
    const indexes = await filesCollection.listIndexes().toArray();
    console.log("📋 Database indexes:");
    indexes.forEach(index => {
      const uniqueFlag = index.unique ? " (UNIQUE)" : "";
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${uniqueFlag}`);
    });
    
    await mongoose.disconnect();
    console.log("👋 MongoDB disconnected\n");
    
  } catch (mongoError) {
    console.error("❌ MongoDB connection failed:", mongoError.message);
  }

  // Test AWS S3 connection
  try {
    console.log("☁️ Testing AWS S3 connection...");
    
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const response = await s3.send(new ListBucketsCommand({}));
    console.log("✅ AWS S3 connected successfully");
    console.log(`📦 Available buckets: ${response.Buckets.length}`);
    
    // Check if our target bucket exists
    const targetBucket = process.env.S3_BUCKET_NAME;
    const bucketExists = response.Buckets.some(bucket => bucket.Name === targetBucket);
    console.log(`🎯 Target bucket '${targetBucket}': ${bucketExists ? '✅ Found' : '❌ Not found'}`);
    
  } catch (s3Error) {
    console.error("❌ AWS S3 connection failed:", s3Error.message);
  }

  console.log("\n🎉 Connection tests completed!");
}

// Run the tests
testConnections(); 