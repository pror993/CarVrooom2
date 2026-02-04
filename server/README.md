# CarVrooom Backend API

Backend server for CarVrooom - Automotive Predictive Maintenance Platform

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Environment Variables
Create a `.env` file:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/carvrooom
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
```

### Run Server
```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

## 📡 API Endpoints

### Authentication

#### Signup
```
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "role": "vehicle_owner",
  "name": "John Doe",
  "phone": "1234567890",
  "address": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip": "400001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec49f1b2c72b8c8e4f1a",
    "email": "user@example.com",
    "role": "vehicle_owner",
    "profile": {
      "name": "John Doe",
      "phone": "1234567890"
    }
  }
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer <token>
```

### User Management

#### Get User Profile
```
GET /api/users/profile
Authorization: Bearer <token>
```

#### Update User Profile
```
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "phone": "9876543210",
  "address": {
    "city": "Delhi"
  }
}
```

#### Get All Users (Service Center/Fleet Owner only)
```
GET /api/users
Authorization: Bearer <token>
```

#### Get User by ID
```
GET /api/users/:id
Authorization: Bearer <token>
```

#### Delete Account
```
DELETE /api/users/:id
Authorization: Bearer <token>
```

## 🔐 User Roles

- `vehicle_owner` - Individual vehicle owners (default)
- `fleet_owner` - Fleet managers
- `service_center` - Service center administrators
- `technician` - Service technicians

## 🗄️ MongoDB Setup

Make sure MongoDB is running:

```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Or run manually
mongod --dbpath /path/to/data
```

## 📦 Tech Stack

- **Express.js** - Web framework
- **MongoDB + Mongoose** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin requests

## 🔧 Development

Server auto-restarts on file changes with nodemon.

Check server status:
```
curl http://localhost:3000
```

Response:
```json
{"message": "CarVrooom API Server is running!"}
```

## 🧪 Testing with curl

### Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "role": "vehicle_owner"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

### Get Profile (replace TOKEN)
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
