import express from 'express';
import resend from '../config/email.js';

const router = express.Router();

/**
 * @route   POST /api/support/send-message
 * @desc    Send support message to admin email using Resend
 * @access  Public
 */
router.post('/send-message', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Email to admin
    const adminEmail = await resend.emails.send({
      from: 'Hood Shop Support <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL || 'macleaann723@gmail.com',
      subject: `Support Request: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            New Support Request
          </h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>From:</strong> ${name}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>
          </div>
          <div style="padding: 20px; background-color: #ffffff; border-left: 4px solid #007bff;">
            <h3 style="color: #1a1a1a; margin-top: 0;">Message:</h3>
            <p style="line-height: 1.6; color: #495057;">${message}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px; font-size: 12px; color: #6c757d;">
            <p style="margin: 0;">This is an automated message from Hood Shop support system.</p>
            <p style="margin: 5px 0 0 0;">Reply to ${email} to respond to ${name}</p>
          </div>
        </div>
      `,
      reply_to: email,
    });

    // Auto-reply to customer
    const customerEmail = await resend.emails.send({
      from: 'Hood Shop Support <onboarding@resend.dev>',
      to: email,
      subject: `We received your message: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            Thank You for Contacting Us
          </h2>
          <div style="padding: 20px;">
            <p style="line-height: 1.6; color: #495057;">Hello ${name},</p>
            <p style="line-height: 1.6; color: #495057;">
              Thank you for reaching out to Hood Shop support. We have received your message and our team will get back to you as soon as possible.
            </p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #6c757d;"><strong>Your message:</strong></p>
              <p style="margin: 10px 0 0 0; color: #495057;">${message}</p>
            </div>
            <p style="line-height: 1.6; color: #495057;">
              We typically respond within 24-48 hours during business days.
            </p>
            <p style="line-height: 1.6; color: #495057;">
              Best regards,<br/>
              <strong>Hood Shop Support Team</strong>
            </p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #6c757d;">
              Need immediate assistance? Visit our <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/support" style="color: #007bff; text-decoration: none;">support page</a>
            </p>
          </div>
        </div>
      `,
    });

    console.log('Admin email sent:', adminEmail.data?.id);
    console.log('Customer email sent:', customerEmail.data?.id);

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!',
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
