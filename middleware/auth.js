import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists in database
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email, name, phone_code, phone, address, city, state, zip_code, country, avatar_url')
      .eq('id', decoded.userId);

    if (!users || users.length === 0) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not found'
      });
    }

    // Convert snake_case to camelCase for consistency
    const user = users[0];
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneCode: user.phone_code,
      phone: user.phone,
      address: user.address,
      city: user.city,
      state: user.state,
      zipCode: user.zip_code,
      country: user.country,
      avatarUrl: user.avatar_url
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Token expired' 
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Authentication failed' 
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email, name, phone_code, phone, address, city, state, zip_code, country, avatar_url')
      .eq('id', decoded.userId);

    if (users && users.length > 0) {
      const user = users[0];
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneCode: user.phone_code,
        phone: user.phone,
        address: user.address,
        city: user.city,
        state: user.state,
        zipCode: user.zip_code,
        country: user.country,
        avatarUrl: user.avatar_url
      };
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    // If token is invalid, just set user to null and continue
    req.user = null;
    next();
  }
};
