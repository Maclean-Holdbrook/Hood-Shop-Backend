import { supabaseAdmin } from '../config/supabase.js';

const clearAllProducts = async () => {
  try {
    console.log('🧹 Clearing all products from database...');

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (error) {
      throw error;
    }

    console.log('✅ All products cleared successfully!');
    console.log('📝 You can now add products via the admin panel.');
  } catch (error) {
    console.error('❌ Error clearing products:', error);
    throw error;
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
