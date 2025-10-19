import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    // Test 1: List buckets
    console.log('\n1. Testing storage buckets...');
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
    } else {
      console.log('✅ Buckets found:', buckets.map(b => b.name).join(', '));
    }

    // Test 2: Query products table
    console.log('\n2. Testing products table...');
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('*')
      .limit(5);

    if (productsError) {
      console.error('❌ Error querying products:', productsError);
    } else {
      console.log('✅ Products table accessible. Found', products.length, 'products');
    }

    // Test 3: Query admin_users table
    console.log('\n3. Testing admin_users table...');
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('admin_users')
      .select('email, name, role')
      .limit(5);

    if (adminsError) {
      console.error('❌ Error querying admin_users:', adminsError);
    } else {
      console.log('✅ Admin users table accessible. Found', admins.length, 'admin users');
      admins.forEach(admin => console.log('  -', admin.email, `(${admin.role})`));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConnection();
