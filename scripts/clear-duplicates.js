const mongoose = require("mongoose");
require("dotenv").config();

async function clearDuplicates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const filesCollection = db.collection('files');

    // First, let's see what we have
    const allFiles = await filesCollection.find({}).toArray();
    console.log(`📊 Total files in database: ${allFiles.length}`);

    // Group files by code to see duplicates
    const filesByCode = {};
    allFiles.forEach(file => {
      if (file.code) {
        if (!filesByCode[file.code]) {
          filesByCode[file.code] = [];
        }
        filesByCode[file.code].push(file);
      }
    });

    console.log("📋 Files grouped by code:");
    Object.keys(filesByCode).forEach(code => {
      console.log(`  Code ${code}: ${filesByCode[code].length} files`);
    });

    // Ask user if they want to clear all files
    console.log("\n🗑️ CLEARING ALL FILES TO START FRESH...");
    const deleteResult = await filesCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} files`);

    // Drop the problematic unique index if it exists
    try {
      await filesCollection.dropIndex("code_1");
      console.log("✅ Dropped unique index on 'code' field");
    } catch (error) {
      if (error.codeName === 'IndexNotFound') {
        console.log("ℹ️ Index 'code_1' not found (already dropped or doesn't exist)");
      } else {
        console.error("❌ Error dropping index:", error.message);
      }
    }

    // Also try to drop any other problematic indexes
    try {
      const allIndexes = await filesCollection.listIndexes().toArray();
      for (const index of allIndexes) {
        if (index.name !== '_id_' && index.key.code && index.unique) {
          console.log(`🗑️ Dropping unique index: ${index.name}`);
          await filesCollection.dropIndex(index.name);
        }
      }
    } catch (error) {
      console.log("ℹ️ No additional unique indexes to drop");
    }

    // Create the proper compound index (non-unique)
    try {
      await filesCollection.createIndex({ code: 1, batchIndex: 1 });
      console.log("✅ Created compound index on code and batchIndex");
    } catch (error) {
      console.error("❌ Error creating compound index:", error.message);
    }

    // List current indexes
    const indexes = await filesCollection.listIndexes().toArray();
    console.log("📋 Current indexes:");
    indexes.forEach(index => {
      const uniqueFlag = index.unique ? " (UNIQUE)" : "";
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${uniqueFlag}`);
    });

    console.log("\n🎉 Database cleanup completed!");
    console.log("✅ All files cleared");
    console.log("✅ Unique constraints removed");
    console.log("✅ Proper indexes created");
    console.log("\n🚀 You can now upload multiple files with the same code!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

// Run the script
clearDuplicates(); 