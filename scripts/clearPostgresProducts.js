import pool from '../config/database.js';

const clearAllProducts = async () => {
  try {
    console.log('🧹 Clearing all products from PostgreSQL database...');

    const result = await pool.query('DELETE FROM products');

    console.log(`✅ Deleted ${result.rowCount} products successfully!`);
    console.log('📝 You can now add products via the admin panel.');
  } catch (error) {
    console.error('❌ Error clearing products:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

clearAllProducts()
  .then(() => {
    console.log('✅ Cleanup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
