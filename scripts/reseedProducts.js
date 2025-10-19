import pool from '../config/database.js';

const reseedDatabase = async () => {
  try {
    console.log('🔄 Starting database reseed...');

    // Clear existing products
    const client = await pool.connect();
    await client.query('DELETE FROM products');
    console.log('✅ Cleared existing products');
    client.release();

    // Import and run seed function
    const { seedProducts } = await import('./seedData.js');
    await seedProducts();

    console.log('🎉 Database reseed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Reseed failed:', error);
    process.exit(1);
  }
};

reseedDatabase();
