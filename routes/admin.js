import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import { Resend } from 'resend';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find admin user
    const { data: admin, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await supabaseAdmin
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create admin user (protected - only super admins can create)
router.post('/create-admin', authenticateAdmin, async (req, res) => {
  try {
    const { email, password, name, role = 'admin' } = req.body;

    // Check if requester is super_admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can create admin users' });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if admin already exists
    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Admin user already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create admin user
    const { data: admin, error } = await supabaseAdmin
      .from('admin_users')
      .insert([{ email, password_hash, name, role }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Admin user created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// ==========================================
// PRODUCT MANAGEMENT
// ==========================================

// Get all products (admin view with more details)
router.get('/products', authenticateAdmin, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, error, count } = await query;

    if (error) throw error;

    res.json({
      products,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create new product
router.post('/products', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      original_price,
      discount,
      category,
      images,
      sizes,
      colors,
      features,
      stock,
      is_new,
      is_featured
    } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert([
        {
          name,
          description,
          price,
          original_price,
          discount: discount || 0,
          category,
          images: images || [],
          sizes: sizes || [],
          colors: colors || [],
          features: features || [],
          stock: stock || 0,
          is_new: is_new || false,
          is_featured: is_featured || false,
          created_by: req.admin.id
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ product, message: 'Product created successfully' });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/products/:productId', authenticateAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    // Don't update images if it's an empty array or undefined (preserve existing images)
    // Only update images if explicitly provided with content
    if (updateData.images !== undefined && (!Array.isArray(updateData.images) || updateData.images.length === 0)) {
      // Get existing product to preserve images
      const { data: existingProduct } = await supabaseAdmin
        .from('products')
        .select('images')
        .eq('id', productId)
        .single();

      if (existingProduct && existingProduct.images) {
        updateData.images = existingProduct.images;
      }
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product, message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/products/:productId', authenticateAdmin, async (req, res) => {
  try {
    const { productId } = req.params;

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) throw error;

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==========================================
// ORDER MANAGEMENT
// ==========================================

// Get all orders
router.get('/orders', authenticateAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          name,
          email
        ),
        order_items (
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          price,
          products (
            name,
            images
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%`);
    }

    const { data: orders, error, count } = await query;

    if (error) throw error;

    res.json({
      orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order details
router.get('/orders/:orderId', authenticateAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          name,
          email,
          phone
        ),
        order_items (
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          price,
          products (
            name,
            images
          )
        ),
        order_status_history (
          id,
          order_id,
          status,
          comment,
          created_at,
          updated_by,
          admin_users!order_status_history_updated_by_fkey (
            name
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status
router.patch('/orders/:orderId/status', authenticateAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, comment, tracking_number, notify_customer = true } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get order details
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('id', orderId)
      .single();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order
    const updateData = { status };
    if (tracking_number) {
      updateData.tracking_number = tracking_number;
    }

    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // Create status history entry
    const { data: statusHistory } = await supabaseAdmin
      .from('order_status_history')
      .insert([
        {
          order_id: orderId,
          status,
          comment,
          updated_by: req.admin.id
        }
      ])
      .select(`
        *,
        admin_users!order_status_history_updated_by_fkey (
          name
        )
      `)
      .single();

    // Broadcast WebSocket notification to clients tracking this order
    const io = req.app.get('io');
    if (io) {
      io.to(`order-${orderId}`).emit('order-status-update', {
        orderId,
        orderNumber: order.order_number,
        status,
        comment,
        trackingNumber: tracking_number,
        timestamp: new Date().toISOString(),
        updatedBy: req.admin.name || 'Admin'
      });
      console.log(`📡 WebSocket notification sent for order ${order.order_number}`);
    }

    // Send email notification to customer
    if (notify_customer && order.users && order.users.email) {
      try {
        await resend.emails.send({
          from: `Hood Shop <${process.env.ADMIN_EMAIL}>`,
          to: order.users.email,
          subject: `Order ${order.order_number} - Status Update`,
          html: `
            <h2>Order Status Update</h2>
            <p>Hello ${order.users.name || 'Customer'},</p>
            <p>Your order <strong>${order.order_number}</strong> status has been updated to: <strong>${status.toUpperCase()}</strong></p>
            ${tracking_number ? `<p>Tracking Number: <strong>${tracking_number}</strong></p>` : ''}
            ${comment ? `<p>Note: ${comment}</p>` : ''}
            <p>Order Total: $${order.total_amount}</p>
            <p>Thank you for shopping with Hood Shop!</p>
          `
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      order: updatedOrder,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Add notes to order
router.patch('/orders/:orderId/notes', authenticateAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ notes })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    res.json({ order, message: 'Notes updated successfully' });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

// ==========================================
// USER MANAGEMENT
// ==========================================

// Get all users (everyone who signed up)
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('users')
      .select('id, name, email, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    res.json({
      users,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all customers (users who have placed orders)
router.get('/customers', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    // Get distinct user IDs from orders
    const { data: orderUsers, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('user_id')
      .not('user_id', 'is', null);

    if (orderError) throw orderError;

    // Get unique user IDs
    const uniqueUserIds = [...new Set(orderUsers.map(o => o.user_id))];

    if (uniqueUserIds.length === 0) {
      return res.json({
        customers: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }
      });
    }

    // Build query for users who have placed orders
    let query = supabaseAdmin
      .from('users')
      .select(`
        id,
        name,
        email,
        created_at,
        orders!orders_user_id_fkey (
          id,
          order_number,
          total_amount,
          status,
          created_at
        )
      `, { count: 'exact' })
      .in('id', uniqueUserIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: customers, error, count } = await query;

    if (error) throw error;

    // Calculate order stats for each customer
    const customersWithStats = customers.map(customer => {
      const orderCount = customer.orders?.length || 0;
      const totalSpent = customer.orders?.reduce((sum, order) =>
        sum + parseFloat(order.total_amount), 0) || 0;
      const lastOrder = customer.orders?.[0]?.created_at || null;

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        created_at: customer.created_at,
        order_count: orderCount,
        total_spent: parseFloat(totalSpent.toFixed(2)),
        last_order: lastOrder,
        orders: customer.orders
      };
    });

    res.json({
      customers: customersWithStats,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// ==========================================
// DASHBOARD STATISTICS
// ==========================================

router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    // Get total products
    const { count: totalProducts } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Get total orders
    const { count: totalOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Get total customers
    const { count: totalCustomers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get total revenue
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'completed');

    const totalRevenue = orders?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

    // Get pending orders count
    const { count: pendingOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get low stock products
    const { data: lowStockProducts } = await supabaseAdmin
      .from('products')
      .select('id, name, stock')
      .lte('stock', 10)
      .order('stock', { ascending: true })
      .limit(10);

    // Get recent orders
    const { data: recentOrders } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      pendingOrders,
      lowStockProducts,
      recentOrders
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

export default router;
