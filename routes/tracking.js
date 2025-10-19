import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// ==========================================
// ORDER TRACKING (Public - No Auth Required)
// ==========================================

// Track order by order number and email
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required to track order' });
    }

    // Find order with matching order number and customer email
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        total_amount,
        tracking_number,
        created_at,
        shipping_address,
        users!orders_user_id_fkey (
          id,
          name,
          email
        ),
        order_items (
          id,
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
      .eq('order_number', orderNumber)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify email matches
    if (!order.users || order.users.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Invalid email for this order' });
    }

    // Sort status history by created_at
    if (order.order_status_history) {
      order.order_status_history.sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );
    }

    res.json({ order });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// Get order tracking updates (real-time status history)
router.get('/track/:orderNumber/updates', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // First verify the order belongs to this email
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        users!orders_user_id_fkey (
          email
        )
      `)
      .eq('order_number', orderNumber)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.users || order.users.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Invalid email for this order' });
    }

    // Get all status updates
    const { data: updates, error } = await supabaseAdmin
      .from('order_status_history')
      .select(`
        id,
        status,
        comment,
        created_at,
        admin_users!order_status_history_updated_by_fkey (
          name
        )
      `)
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ updates: updates || [] });
  } catch (error) {
    console.error('Error fetching order updates:', error);
    res.status(500).json({ error: 'Failed to fetch order updates' });
  }
});

export default router;
