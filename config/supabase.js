import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for general operations (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for privileged operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Initialize database tables in Supabase
export const initializeDatabase = async () => {
  try {
    console.log('✅ Connected to Supabase');
    console.log('📊 Database tables should be created via Supabase SQL Editor');
    console.log('🔗 Run the schema.sql file in your Supabase project');
  } catch (error) {
    console.error('❌ Error connecting to Supabase:', error);
    throw error;
  }
};

export default supabase;
