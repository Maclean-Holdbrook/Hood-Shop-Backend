import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Verify API key is configured
if (!process.env.RESEND_API_KEY) {
  console.log('⚠️  RESEND_API_KEY not found in environment variables');
  console.log('💡 Please add RESEND_API_KEY to your .env file');
} else {
  console.log('✅ Resend email service is configured');
}

export default resend;
