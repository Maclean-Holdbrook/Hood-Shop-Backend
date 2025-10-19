import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { supabaseAdmin } from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all products with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 10000 }),
  query('category').optional().trim(),
  query('search').optional().trim(),
  query('sort').optional().isIn(['name', 'price', 'rating', 'created_at']),
  query('order').optional().isIn(['asc', 'desc'])
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;
    const sort = req.query.sort || 'created_at';
    const order = req.query.order === 'asc' ? true : false;

    let query = supabaseAdmin.from('products').select('*', { count: 'exact' });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sort, { ascending: order });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) throw error;

    const totalPages = Math.ceil(count / limit);

    res.json({
      products: products || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts: count,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch products'
    });
  }
});

// Get single product by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const productId = req.params.id;

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }

    res.json({
      product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch product'
    });
  }
});

// Get products by category
router.get('/category/:category', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 10000 })
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const category = req.params.category;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const { data: products, error, count } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .eq('category', category)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const totalPages = Math.ceil(count / limit);

    res.json({
      category,
      products: products || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts: count,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch products by category'
    });
  }
});

// Get featured/new products
router.get('/featured/new', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('is_new', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      products: products || []
    });
  } catch (error) {
    console.error('Get new products error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch new products'
    });
  }
});

// Get best selling products (based on rating)
router.get('/featured/bestsellers', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .gte('rating', 4.0)
      .gt('rating_count', 0)
      .order('rating', { ascending: false })
      .order('rating_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      products: products || []
    });
  } catch (error) {
    console.error('Get bestseller products error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch bestseller products'
    });
  }
});

// Search products
router.get('/search/:query', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 10000 })
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const searchQuery = req.params.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const { data: products, error, count } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order('rating', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const totalPages = Math.ceil(count / limit);

    res.json({
      query: searchQuery,
      products: products || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts: count,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to search products'
    });
  }
});

// Get all categories
router.get('/meta/categories', async (req, res) => {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('category')
      .not('category', 'is', null);

    if (error) throw error;

    // Extract unique categories
    const categories = [...new Set(products.map(p => p.category))].sort();

    res.json({
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch categories'
    });
  }
});

export default router;
