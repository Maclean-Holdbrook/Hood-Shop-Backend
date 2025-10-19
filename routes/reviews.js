import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10, offset = 0, sort = 'recent' } = req.query;

    let query = supabaseAdmin
      .from('product_reviews')
      .select(`
        *,
        users!product_reviews_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('product_id', productId)
      .range(offset, offset + parseInt(limit) - 1);

    // Sort options
    if (sort === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'rating_high') {
      query = query.order('rating', { ascending: false });
    } else if (sort === 'rating_low') {
      query = query.order('rating', { ascending: true });
    } else if (sort === 'helpful') {
      query = query.order('helpful_count', { ascending: false });
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Get total count for pagination
    const { count: totalCount } = await supabaseAdmin
      .from('product_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);

    res.json({
      reviews: data,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + parseInt(limit) < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get review statistics for a product
router.get('/product/:productId/stats', async (req, res) => {
  try {
    const { productId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('product_reviews')
      .select('rating')
      .eq('product_id', productId);

    if (error) throw error;

    const totalReviews = data.length;
    const averageRating = totalReviews > 0
      ? data.reduce((sum, review) => sum + review.rating, 0) / totalReviews
      : 0;

    // Calculate rating distribution
    const ratingDistribution = {
      5: data.filter(r => r.rating === 5).length,
      4: data.filter(r => r.rating === 4).length,
      3: data.filter(r => r.rating === 3).length,
      2: data.filter(r => r.rating === 2).length,
      1: data.filter(r => r.rating === 1).length,
    };

    res.json({
      totalReviews,
      averageRating: parseFloat(averageRating.toFixed(2)),
      ratingDistribution
    });
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

// Create a new review
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, rating, title, comment, images } = req.body;
    const userId = req.user.id;

    // Debug logging
    console.log('📝 Review submission received:');
    console.log('  Product ID:', product_id);
    console.log('  User ID:', userId);
    console.log('  Rating:', rating);

    // Validate input
    if (!product_id || !rating) {
      return res.status(400).json({ error: 'Product ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if product exists
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', product_id)
      .single();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if user already reviewed this product
    const { data: existingReview } = await supabaseAdmin
      .from('product_reviews')
      .select('id')
      .eq('product_id', product_id)
      .eq('user_id', userId)
      .single();

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    // Create review
    const { data: review, error } = await supabaseAdmin
      .from('product_reviews')
      .insert([
        {
          product_id,
          user_id: userId,
          rating,
          title,
          comment,
          images: images || []
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ review, message: 'Review created successfully' });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Update a review
router.put('/:reviewId', authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = req.user.id;

    // Check if review exists and belongs to user
    const { data: existingReview } = await supabaseAdmin
      .from('product_reviews')
      .select('*')
      .eq('id', reviewId)
      .eq('user_id', userId)
      .single();

    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found or unauthorized' });
    }

    // Update review
    const { data: review, error } = await supabaseAdmin
      .from('product_reviews')
      .update({
        rating: rating || existingReview.rating,
        title: title !== undefined ? title : existingReview.title,
        comment: comment !== undefined ? comment : existingReview.comment,
        images: images !== undefined ? images : existingReview.images
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;

    res.json({ review, message: 'Review updated successfully' });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete a review
router.delete('/:reviewId', authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Check if review exists and belongs to user
    const { data: existingReview } = await supabaseAdmin
      .from('product_reviews')
      .select('*')
      .eq('id', reviewId)
      .eq('user_id', userId)
      .single();

    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found or unauthorized' });
    }

    // Delete review
    const { error } = await supabaseAdmin
      .from('product_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Mark review as helpful
router.post('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const { data: review } = await supabaseAdmin
      .from('product_reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .single();

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const { error } = await supabaseAdmin
      .from('product_reviews')
      .update({ helpful_count: (review.helpful_count || 0) + 1 })
      .eq('id', reviewId);

    if (error) throw error;

    res.json({ message: 'Marked as helpful' });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

export default router;
