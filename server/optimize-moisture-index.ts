import { pool } from "./db";

/**
 * Creates optimal database index for the moisture readings query.
 * This index will make the DISTINCT ON query much faster.
 */
async function createMoistureIndex() {
  try {
    console.log("Creating optimal index for moisture readings query...");
    
    // Create composite index that matches our query pattern
    // This index supports: DISTINCT ON (latitude, longitude) ORDER BY latitude, longitude, created_at DESC
    const indexQuery = `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moisture_readings_lat_lng_created
      ON moisture_readings (latitude, longitude, created_at DESC)
    `;
    
    await pool.query(indexQuery);
    console.log("✅ Moisture readings index created successfully");
    
    // Also create a simple index on road_asset_id for better performance
    const roadAssetIndexQuery = `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moisture_readings_road_asset
      ON moisture_readings (road_asset_id)
    `;
    
    await pool.query(roadAssetIndexQuery);
    console.log("✅ Road asset index created successfully");
    
    // Check the query performance
    const explainQuery = `
      EXPLAIN ANALYZE 
      SELECT DISTINCT ON (latitude, longitude) 
        id, road_asset_id, latitude, longitude, moisture_value, reading_date, created_at
      FROM moisture_readings 
      ORDER BY latitude, longitude, created_at DESC
      LIMIT 100
    `;
    
    const result = await pool.query(explainQuery);
    console.log("Query performance analysis:");
    result.rows.forEach(row => console.log(row['QUERY PLAN']));
    
  } catch (error) {
    console.error("Error creating moisture index:", error);
  } finally {
    process.exit(0);
  }
}

// Run the optimization
createMoistureIndex();