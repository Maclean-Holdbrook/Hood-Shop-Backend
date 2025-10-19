import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/supabase.js';

async function createAdmin() {
  try {
    const email = 'admin@hoodshop.com';
    const password = 'admin123';
    const name = 'Admin User';
    const role = 'super_admin';

    // Generate password hash
    const password_hash = await bcrypt.hash(password, 10);

    console.log('Creating admin user...');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Password Hash:', password_hash);

    // Check if admin already exists
    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();

    if (existing) {
      console.log('\n⚠️  Admin user already exists! Updating password...');

      // Update existing admin
      const { data: updated, error } = await supabaseAdmin
        .from('admin_users')
        .update({ password_hash, is_active: true })
        .eq('email', email)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Admin password updated successfully!');
      console.log('Updated admin:', updated);
    } else {
      // Create new admin
      const { data: admin, error } = await supabaseAdmin
        .from('admin_users')
        .insert([
          {
            email,
            password_hash,
            name,
            role,
            is_active: true
          }
        ])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Admin user created successfully!');
      console.log('Admin details:', admin);
    }

    console.log('\n🎉 You can now login with:');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nLogin at: http://localhost:5173/admin/login');

  } catch (error) {
    console.error('❌ Error creating admin:', error);

    if (error.message.includes('relation "admin_users" does not exist')) {
      console.log('\n⚠️  The admin_users table does not exist!');
      console.log('Please run the schema.sql file in Supabase SQL Editor first.');
      console.log('File location: hood-shop-backend/config/schema.sql');
    }
  }
}

createAdmin();
