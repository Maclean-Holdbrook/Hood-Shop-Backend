# Hood Shop Backend API

A robust Express.js backend API for the Hood Shop e-commerce application, featuring JWT authentication, product management, cart functionality, and user management.

## 🚀 Features

- **Authentication & Authorization**: JWT-based user authentication with secure password hashing
- **Product Management**: Full CRUD operations for products with filtering, search, and pagination
- **Shopping Cart**: Complete cart management with persistent storage
- **User Management**: User profiles, orders, and statistics
- **Database Integration**: PostgreSQL with connection pooling
- **Security**: CORS configuration, rate limiting, input validation, and helmet security headers
- **API Documentation**: RESTful API endpoints with comprehensive error handling

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hood-shop-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=hoodshop
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d
   ```

4. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE hoodshop;
   CREATE USER your_db_user WITH PASSWORD 'your_db_password';
   GRANT ALL PRIVILEGES ON DATABASE hoodshop TO your_db_user;
   ```

5. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password

### Products
- `GET /api/products` - Get all products (with filtering & pagination)
- `GET /api/products/:id` - Get single product
- `GET /api/products/category/:category` - Get products by category
- `GET /api/products/featured/new` - Get new products
- `GET /api/products/featured/bestsellers` - Get bestseller products
- `GET /api/products/search/:query` - Search products
- `GET /api/products/meta/categories` - Get all categories

### Cart (Requires Authentication)
- `GET /api/cart` - Get user's cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/item/:itemId` - Update cart item quantity
- `DELETE /api/cart/item/:itemId` - Remove item from cart
- `DELETE /api/cart/clear` - Clear entire cart
- `GET /api/cart/count` - Get cart item count

### Users (Requires Authentication)
- `GET /api/users/stats` - Get user statistics
- `GET /api/users/orders` - Get user orders
- `GET /api/users/orders/:orderId` - Get specific order details

### Health Check
- `GET /health` - Server health status

## 🔧 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Products Table
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  discount INTEGER,
  category VARCHAR(100),
  images JSON,
  sizes JSON,
  colors JSON,
  features JSON,
  rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0,
  is_new BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Cart Items Table
```sql
CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  selected_size VARCHAR(50),
  selected_color VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id, selected_size, selected_color)
);
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Response Format
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

## 🌐 CORS Configuration

The API is configured to allow requests from your frontend domain. Update the `FRONTEND_URL` environment variable to match your frontend URL.

## 📊 Sample Data

The application automatically seeds the database with sample products when running in development mode. You can also manually run the seeder:

```bash
node scripts/seedData.js
```

## 🚀 Frontend Integration

### Update API Base URL
```javascript
// src/services/api.js
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Replace Mock Data
- Remove mock data imports from `ProductContext.jsx`
- Update `fetchProducts()` and `fetchProduct()` methods to use real API calls
- Update authentication methods in `AuthContext.jsx`

## 🔧 Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run lint` - Run ESLint

### Environment Variables
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRES_IN` - JWT expiration time

## 📝 API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error type",
  "message": "Error description",
  "details": [ ... ]
}
```

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for specific frontend domain
- **Helmet**: Security headers
- **Input Validation**: Express-validator for request validation
- **Password Hashing**: bcryptjs with salt rounds
- **JWT Security**: Secure token generation and validation

## 📈 Performance

- **Connection Pooling**: PostgreSQL connection pooling
- **Indexes**: Database indexes for optimal query performance
- **Pagination**: Built-in pagination for large datasets
- **Error Handling**: Comprehensive error handling and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.