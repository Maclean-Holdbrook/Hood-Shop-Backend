import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All cart routes require authentication
router.use(authenticateToken);

// Get user's cart
router.get('/', async (req, res) => {
  try {
    const cartResult = await pool.query(
      `SELECT 
        ci.id, ci.quantity, ci.selected_size, ci.selected_color, ci.created_at,
        p.id as product_id, p.name, p.price, p.original_price, p.discount,
        p.images, p.stock, p.category
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC`,
      [req.user.id]
    );

    // Calculate totals
    let totalItems = 0;
    let totalAmount = 0;
    let totalDiscount = 0;

    const cartItems = cartResult.rows.map(item => {
      const currentPrice = item.discount > 0 ? 
        item.price * (1 - item.discount / 100) : item.price;
      
      const itemTotal = currentPrice * item.quantity;
      const itemDiscount = item.original_price ? 
        (item.original_price - currentPrice) * item.quantity : 0;

      totalItems += item.quantity;
      totalAmount += itemTotal;
      totalDiscount += itemDiscount;

      return {
        id: item.id,
        product: {
          id: item.product_id,
          name: item.name,
          price: item.price,
          original_price: item.original_price,
          discount: item.discount,
          images: item.images,
          stock: item.stock,
          category: item.category
        },
        quantity: item.quantity,
        selected_size: item.selected_size,
        selected_color: item.selected_color,
        item_total: parseFloat(itemTotal.toFixed(2)),
        created_at: item.created_at
      };
    });

    res.json({
      cart: {
        items: cartItems,
        summary: {
          total_items: totalItems,
          total_amount: parseFloat(totalAmount.toFixed(2)),
          total_discount: parseFloat(totalDiscount.toFixed(2)),
          estimated_total: parseFloat((totalAmount - totalDiscount).toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch cart'
    });
  }
});

// Add item to cart
router.post('/add', [
  body('product_id').isInt({ min: 1 }),
  body('quantity').isInt({ min: 1 }),
  body('selected_size').optional().trim(),
  body('selected_color').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { product_id, quantity, selected_size, selected_color } = req.body;

    // Check if product exists and has stock
    const productResult = await pool.query(
      'SELECT id, name, price, stock FROM products WHERE id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }

    const product = productResult.rows[0];

    if (product.stock < quantity) {
      return res.status(400).json({
        error: 'Insufficient stock',
        message: `Only ${product.stock} items available in stock`
      });
    }

    // Check if item already exists in cart
    const existingItem = await pool.query(
      `SELECT id, quantity FROM cart_items 
       WHERE user_id = $1 AND product_id = $2 AND selected_size = $3 AND selected_color = $4`,
      [req.user.id, product_id, selected_size || null, selected_color || null]
    );

    if (existingItem.rows.length > 0) {
      // Update existing item quantity
      const newQuantity = existingItem.rows[0].quantity + quantity;
      
      if (newQuantity > product.stock) {
        return res.status(400).json({
          error: 'Insufficient stock',
          message: `Cannot add ${quantity} more items. Only ${product.stock - existingItem.rows[0].quantity} more available`
        });
      }

      await pool.query(
        'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2',
        [newQuantity, existingItem.rows[0].id]
      );

      res.json({
        message: 'Cart item updated successfully',
        cart_item: {
          id: existingItem.rows[0].id,
          product_id,
          quantity: newQuantity,
          selected_size,
          selected_color
        }
      });
    } else {
      // Add new item to cart
      const newItem = await pool.query(
        `INSERT INTO cart_items (user_id, product_id, quantity, selected_size, selected_color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, quantity, selected_size, selected_color, created_at`,
        [req.user.id, product_id, quantity, selected_size || null, selected_color || null]
      );

      res.status(201).json({
        message: 'Item added to cart successfully',
        cart_item: newItem.rows[0]
      });
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add item to cart'
    });
  }
});

// Update cart item quantity
router.put('/item/:itemId', [
  body('quantity').isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const itemId = parseInt(req.params.itemId);
    const { quantity } = req.body;

    if (isNaN(itemId)) {
      return res.status(400).json({
        error: 'Invalid item ID',
        message: 'Item ID must be a number'
      });
    }

    // Check if cart item exists and belongs to user
    const cartItemResult = await pool.query(
      `SELECT ci.id, ci.product_id, p.stock, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.id = $1 AND ci.user_id = $2`,
      [itemId, req.user.id]
    );

    if (cartItemResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Cart item not found',
        message: 'The requested cart item does not exist'
      });
    }

    const cartItem = cartItemResult.rows[0];

    if (quantity > cartItem.stock) {
      return res.status(400).json({
        error: 'Insufficient stock',
        message: `Only ${cartItem.stock} items available for ${cartItem.name}`
      });
    }

    // Update quantity
    const updatedItem = await pool.query(
      'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [quantity, itemId]
    );

    res.json({
      message: 'Cart item updated successfully',
      cart_item: updatedItem.rows[0]
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update cart item'
    });
  }
});

// Remove item from cart
router.delete('/item/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);

    if (isNaN(itemId)) {
      return res.status(400).json({
        error: 'Invalid item ID',
        message: 'Item ID must be a number'
      });
    }

    // Check if cart item exists and belongs to user
    const cartItemResult = await pool.query(
      'SELECT id FROM cart_items WHERE id = $1 AND user_id = $2',
      [itemId, req.user.id]
    );

    if (cartItemResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Cart item not found',
        message: 'The requested cart item does not exist'
      });
    }

    // Delete cart item
    await pool.query(
      'DELETE FROM cart_items WHERE id = $1',
      [itemId]
    );

    res.json({
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to remove cart item'
    });
  }
});

// Clear entire cart
router.delete('/clear', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM cart_items WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to clear cart'
    });
  }
});

// Get cart item count
router.get('/count', async (req, res) => {
  try {
    const countResult = await pool.query(
      'SELECT SUM(quantity) as total_items FROM cart_items WHERE user_id = $1',
      [req.user.id]
    );

    const totalItems = countResult.rows[0].total_items || 0;

    res.json({
      total_items: parseInt(totalItems)
    });
  } catch (error) {
    console.error('Get cart count error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get cart count'
    });
  }
});

export default router;
