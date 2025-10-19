import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get cart item count
    const cartCountResult = await pool.query(
      'SELECT SUM(quantity) as cart_items FROM cart_items WHERE user_id = $1',
      [userId]
    );

    // Get order count
    const orderCountResult = await pool.query(
      'SELECT COUNT(*) as order_count FROM orders WHERE user_id = $1',
      [userId]
    );

    // Get total spent
    const totalSpentResult = await pool.query(
      'SELECT COALESCE(SUM(total_amount), 0) as total_spent FROM orders WHERE user_id = $1 AND status = $2',
      [userId, 'completed']
    );

    res.json({
      stats: {
        cart_items: parseInt(cartCountResult.rows[0].cart_items || 0),
        total_orders: parseInt(orderCountResult.rows[0].order_count),
        total_spent: parseFloat(totalSpentResult.rows[0].total_spent)
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user statistics'
    });
  }
});

// Get user orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total order count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [userId]
    );
    const totalOrders = parseInt(countResult.rows[0].count);

    // Get orders with order items
    const ordersResult = await pool.query(
      `SELECT 
        o.id, o.total_amount, o.status, o.payment_method, o.created_at,
        oi.product_id, oi.quantity, oi.price, oi.selected_size, oi.selected_color,
        p.name as product_name, p.images as product_images
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Group orders and their items
    const ordersMap = new Map();
    
    ordersResult.rows.forEach(row => {
      if (!ordersMap.has(row.id)) {
        ordersMap.set(row.id, {
          id: row.id,
          total_amount: parseFloat(row.total_amount),
          status: row.status,
          payment_method: row.payment_method,
          created_at: row.created_at,
          items: []
        });
      }

      if (row.product_id) {
        ordersMap.get(row.id).items.push({
          product_id: row.product_id,
          product_name: row.product_name,
          product_images: row.product_images,
          quantity: row.quantity,
          price: parseFloat(row.price),
          selected_size: row.selected_size,
          selected_color: row.selected_color,
          item_total: parseFloat(row.price * row.quantity)
        });
      }
    });

    const orders = Array.from(ordersMap.values());
    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      orders,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user orders'
    });
  }
});

// Get specific order details
router.get('/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = parseInt(req.params.orderId);

    if (isNaN(orderId)) {
      return res.status(400).json({
        error: 'Invalid order ID',
        message: 'Order ID must be a number'
      });
    }

    // Get order details
    const orderResult = await pool.query(
      `SELECT 
        o.id, o.total_amount, o.status, o.payment_method, o.shipping_address,
        o.created_at, o.updated_at
      FROM orders o
      WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'The requested order does not exist'
      });
    }

    // Get order items
    const itemsResult = await pool.query(
      `SELECT 
        oi.product_id, oi.quantity, oi.price, oi.selected_size, oi.selected_color,
        p.name as product_name, p.description as product_description,
        p.images as product_images, p.category
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1`,
      [orderId]
    );

    const order = {
      ...orderResult.rows[0],
      total_amount: parseFloat(orderResult.rows[0].total_amount),
      items: itemsResult.rows.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_description: item.product_description,
        product_images: item.product_images,
        product_category: item.category,
        quantity: item.quantity,
        price: parseFloat(item.price),
        selected_size: item.selected_size,
        selected_color: item.selected_color,
        item_total: parseFloat(item.price * item.quantity)
      }))
    };

    res.json({
      order
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order details'
    });
  }
});

export default router;
