const mongoose = require("mongoose");
require("dotenv").config();

async function fixDatabaseIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection('files');

    // Drop the old unique index on 'code' field
    try {
      await collection.dropIndex("code_1");
      console.log("✅ Dropped old unique index on 'code' field");
    } catch (error) {
      if (error.codeName === 'IndexNotFound') {
        console.log("ℹ️ Index 'code_1' not found (already dropped or doesn't exist)");
      } else {
        console.error("❌ Error dropping index:", error.message);
      }
    }

    // Create compound index for code and batchIndex
    try {
      await collection.createIndex({ code: 1, batchIndex: 1 });
      console.log("✅ Created compound index on code and batchIndex");
    } catch (error) {
      console.error("❌ Error creating compound index:", error.message);
    }

    // List all indexes to verify
    const indexes = await collection.listIndexes().toArray();
    console.log("📋 Current indexes:");
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log("🎉 Database schema fix completed!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

// Run the script
fixDatabaseIndexes(); 