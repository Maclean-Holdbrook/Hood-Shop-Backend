import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { Resend } from 'resend';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Create new order
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      items,
      shipping_address,
      payment_method,
      subtotal,
      shipping_cost,
      tax,
      total_amount
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    if (!shipping_address || !shipping_address.address || !shipping_address.city || !shipping_address.state || !shipping_address.zipCode) {
      return res.status(400).json({ error: 'Complete shipping address is required' });
    }

    if (!shipping_address.country) {
      return res.status(400).json({ error: 'Country is required' });
    }

    if (!shipping_address.phoneCode || !shipping_address.phone) {
      return res.status(400).json({ error: 'Phone number with country code is required' });
    }

    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Format shipping address for database
    const formattedShippingAddress = {
      street: shipping_address.address,
      city: shipping_address.city,
      state: shipping_address.state,
      zip_code: shipping_address.zipCode,
      country: shipping_address.country,
      phone_code: shipping_address.phoneCode,
      phone: shipping_address.phone
    };

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          user_id: userId,
          order_number: orderNumber,
          total_amount: parseFloat(total_amount),
          status: 'pending',
          payment_status: 'completed', // Assuming payment is processed
          payment_method: payment_method || 'card',
          shipping_address: formattedShippingAddress
        }
      ])
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    // Create order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      price: parseFloat(typeof item.price === 'string' ? item.price.replace('$', '') : item.price),
      selected_size: item.selectedSize || item.size || null,
      selected_color: item.selectedColor || item.color || null
    }));

    const { data: createdItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)
      .select();

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Rollback order if items fail
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    // Create initial status history entry
    await supabaseAdmin
      .from('order_status_history')
      .insert([
        {
          order_id: order.id,
          status: 'pending',
          comment: 'Order placed successfully',
          updated_by: null // System generated
        }
      ]);

    // Update product stock
    for (const item of items) {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .single();

      if (product && product.stock >= item.quantity) {
        await supabaseAdmin
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.id);
      }
    }

    // Return complete order data IMMEDIATELY (before sending emails)
    res.status(201).json({
      message: 'Order created successfully',
      order: {
        ...order,
        order_items: createdItems
      }
    });

    // Send confirmation emails asynchronously (non-blocking)
    // This happens AFTER the response is sent, so it doesn't block the user
    setImmediate(async () => {
      try {
        console.log('📧 Attempting to send order confirmation emails...');
        console.log('Customer email:', shipping_address.email || req.user.email);
        console.log('Admin email:', process.env.ADMIN_EMAIL || 'admin@hoodshop.com');

        const itemsHtml = createdItems.map(item => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(item.price).toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('');

        // NOTE: Resend free tier only sends to verified email
        // In production, verify a custom domain at resend.com/domains
        const customerEmailResult = await resend.emails.send({
          from: 'Hood Shop <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL || shipping_address.email || req.user.email, // Send to admin for testing
          reply_to: shipping_address.email || req.user.email, // Customer can reply
          subject: `[TEST - Customer Copy] Order Confirmation - ${orderNumber}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background: #f9fafb; padding: 30px; }
                .invoice { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
                .order-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 10px; text-align: left; }
                .total-row { font-weight: bold; font-size: 1.1em; background: #f3f4f6; }
                .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 0.9em; }
                .track-button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Order Confirmed!</h1>
                </div>
                <div class="content">
                  <h2>Thank you for your order!</h2>
                  <p>Hi ${shipping_address.fullName || 'Customer'},</p>
                  <p>Your order has been successfully placed and is being processed. We'll send you another email when your order ships.</p>

                  <div class="order-details">
                    <h3>Order Details</h3>
                    <p><strong>Order Number:</strong> ${orderNumber}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p><strong>Status:</strong> Pending</p>
                  </div>

                  <div class="invoice">
                    <h3>Invoice</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style="text-align: center;">Quantity</th>
                          <th style="text-align: right;">Price</th>
                          <th style="text-align: right;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                        <tr class="total-row">
                          <td colspan="3" style="padding: 15px; text-align: right;">Total Amount:</td>
                          <td style="padding: 15px; text-align: right;">$${parseFloat(total_amount).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div class="order-details">
                    <h3>Shipping Address</h3>
                    <p>
                      ${shipping_address.fullName}<br>
                      ${formattedShippingAddress.street}<br>
                      ${formattedShippingAddress.city}, ${formattedShippingAddress.state} ${formattedShippingAddress.zip_code}<br>
                      ${formattedShippingAddress.country}
                    </p>
                  </div>

                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/track-order?orderNumber=${orderNumber}&email=${encodeURIComponent(shipping_address.email || req.user.email)}" class="track-button">
                      Track Your Order
                    </a>
                  </div>

                  <p style="margin-top: 30px;">If you have any questions, feel free to contact our support team.</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Hood Shop. All rights reserved.</p>
                  <p>This is an automated email. Please do not reply.</p>
                </div>
              </div>
            </body>
            </html>
          `
        });

        console.log('📨 Customer email response type:', typeof customerEmailResult);
        console.log('📨 Customer email response:', customerEmailResult);
        if (customerEmailResult?.data?.id || customerEmailResult?.id) {
          console.log('✅ Customer email sent successfully! ID:', customerEmailResult?.data?.id || customerEmailResult?.id);
        } else {
          console.log('⚠️ Customer email: No ID in response');
        }

        // Send notification to admin
        const adminEmailResult = await resend.emails.send({
          from: 'Hood Shop Orders <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL || 'admin@hoodshop.com',
          subject: `New Order Received - ${orderNumber}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background: #f9fafb; padding: 30px; }
                .order-box { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background: #f3f4f6; padding: 10px; text-align: left; }
                td { padding: 10px; border-bottom: 1px solid #eee; }
                .manage-button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🛍️ New Order Received</h1>
                </div>
                <div class="content">
                  <div class="order-box">
                    <h3>Order Information</h3>
                    <p><strong>Order Number:</strong> ${orderNumber}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p><strong>Total Amount:</strong> $${parseFloat(total_amount).toFixed(2)}</p>
                    <p><strong>Status:</strong> Pending</p>
                  </div>

                  <div class="order-box">
                    <h3>Customer Information</h3>
                    <p><strong>Name:</strong> ${shipping_address.fullName}</p>
                    <p><strong>Email:</strong> ${shipping_address.email}</p>
                    <p><strong>Phone:</strong> ${formattedShippingAddress.phone_code ? `${formattedShippingAddress.phone_code} ${formattedShippingAddress.phone}` : 'N/A'}</p>
                  </div>

                  <div class="order-box">
                    <h3>Shipping Address</h3>
                    <p>
                      ${formattedShippingAddress.street}<br>
                      ${formattedShippingAddress.city}, ${formattedShippingAddress.state} ${formattedShippingAddress.zip_code}<br>
                      ${formattedShippingAddress.country}
                    </p>
                  </div>

                  <div class="order-box">
                    <h3>Order Items (${createdItems.length} items)</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${createdItems.map(item => `
                          <tr>
                            <td>${item.product_name}</td>
                            <td>${item.quantity}</td>
                            <td>$${parseFloat(item.price).toFixed(2)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>

                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/orders" class="manage-button">
                      Manage Order
                    </a>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `
        });

        console.log('📨 Admin email response type:', typeof adminEmailResult);
        console.log('📨 Admin email response:', adminEmailResult);
        if (adminEmailResult?.data?.id || adminEmailResult?.id) {
          console.log('✅ Admin email sent successfully! ID:', adminEmailResult?.data?.id || adminEmailResult?.id);
        } else {
          console.log('⚠️ Admin email: No ID in response');
        }
        console.log(`📧 Order confirmation emails process completed for ${orderNumber}`);
      } catch (emailError) {
        console.error('Error sending emails:', emailError);
        // Don't fail the order if email fails (already responded to client)
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      error: 'Failed to create order',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's orders
router.get('/my-orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          quantity,
          price,
          selected_size,
          selected_color,
          products (
            id,
            name,
            images
          )
        ),
        order_status_history (
          id,
          status,
          comment,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ orders });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order details
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          quantity,
          price,
          selected_size,
          selected_color,
          products (
            id,
            name,
            images
          )
        ),
        order_status_history (
          id,
          status,
          comment,
          created_at,
          admin_users!order_status_history_updated_by_fkey (
            name
          )
        )
      `)
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' });
      }
      throw error;
    }

    res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

export default router;
