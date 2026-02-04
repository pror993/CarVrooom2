# 🎉 Backend Setup Complete!

## ✅ What's Been Created

### Server Structure
```
server/
├── server.js                    # Main Express app with routes
├── package.json                 # Dependencies and scripts
├── .env                         # Environment variables
├── .gitignore                   # Git ignore file
├── README.md                    # API documentation
│
├── config/
│   └── db.js                    # MongoDB connection
│
├── models/
│   ├── User.js                  # User authentication model
│   └── UserProfile.js           # Role-specific user data
│
├── controllers/
│   ├── authController.js        # Auth logic (signup, login, logout)
│   └── userController.js        # User CRUD operations
│
├── middleware/
│   └── auth.js                  # JWT verification & role authorization
│
└── routes/
    ├── auth.js                  # Auth endpoints
    └── users.js                 # User management endpoints
```

## 📦 Installed Packages
- ✅ **express** - Web framework
- ✅ **mongoose** - MongoDB ODM
- ✅ **bcryptjs** - Password hashing
- ✅ **jsonwebtoken** - JWT authentication
- ✅ **cors** - Cross-origin requests
- ✅ **dotenv** - Environment variables
- ✅ **nodemon** - Auto-restart (dev dependency)

## 🔐 Authentication System
- **JWT-based** authentication
- **Password hashing** with bcryptjs (salt rounds: 10)
- **Role-based** access control (4 roles)
- **Token expiry** configurable (default: 7 days)
- **Protected routes** with middleware

## 🎯 API Endpoints Ready

### Public Endpoints
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Protected Endpoints (Require JWT Token)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users` - Get all users (service_center, fleet_owner only)
- `GET /api/users/:id` - Get user by ID
- `DELETE /api/users/:id` - Deactivate account

## 👥 User Roles Implemented
1. **vehicle_owner** (default) - Individual car owners
2. **fleet_owner** - Fleet managers
3. **service_center** - Service center admins
4. **technician** - Mechanics/technicians

## 📊 Database Models

### User Model
- email (unique, required)
- password (hashed, required)
- role (enum)
- isActive (default: true)
- isVerified (default: false)
- timestamps (createdAt, updatedAt)

**Methods:**
- `comparePassword()` - Compare hashed passwords
- `generateAuthToken()` - Create JWT token

### UserProfile Model
- userId (1:1 with User)
- role (same as User)
- name, phone, address (common fields)
- Role-specific fields:
  - vehicle_owner: vehicleIds, preferredServiceCenter
  - fleet_owner: fleetId, companyName, gstNumber
  - service_center: centerName, centerLocation (GeoJSON), certifications, technicianIds
  - technician: employerId, skills, certificationLevel

## 🚀 How to Start

### 1. Start MongoDB
```bash
# macOS with Homebrew
brew services start mongodb-community

# Or manually
mongod --dbpath /path/to/data
```

### 2. Start Server
```bash
cd server
npm run dev
```

Server runs on: **http://localhost:3000**

## 🧪 Test the API

### Test Base Endpoint
```bash
curl http://localhost:3000
# Response: {"message": "CarVrooom API Server is running!"}
```

### Test Signup
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

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

Copy the `token` from response, then:

### Test Protected Route
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔄 Next Steps

### Phase 1 Complete ✅
- ✅ User authentication (signup/login)
- ✅ JWT token generation
- ✅ Role-based access control
- ✅ User profile management

### Phase 2 - Vehicle Management
Create these models and routes:
- Vehicle model
- Fleet model
- Vehicle CRUD operations
- Vehicle-owner relationships

### Phase 3 - Maintenance & Alerts
- MaintenanceAlert model
- ServiceRequest model
- Alert creation and tracking
- Service booking

### Phase 4 - Advanced Features
- VehicleHealth model
- WarrantyClaim model
- AuditLog model
- Integration with microservices

## 📝 Important Notes

### MongoDB Connection
The server will **crash** if MongoDB isn't running. Make sure to start MongoDB first.

### JWT Secret
Change `JWT_SECRET` in `.env` before deploying to production!

### CORS
Currently allows all origins. Configure in production:
```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### Password Security
- Passwords are hashed with bcrypt (10 salt rounds)
- Never returned in API responses
- Use `.select('+password')` only when needed for authentication

### Soft Delete
User deletion is **soft delete** (sets `isActive: false`). User data remains in database.

## 🎨 Connect Frontend

In your React app, create an API service:

```javascript
// frontend/src/services/api.js
const API_URL = 'http://localhost:3000/api';

export const signup = async (userData) => {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.json();
};

export const login = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  return response.json();
};

export const getProfile = async (token) => {
  const response = await fetch(`${API_URL}/users/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

## 🐛 Troubleshooting

### MongoDB Connection Error
```
❌ MongoDB Connection Error: connect ECONNREFUSED ::1:27017
```
**Solution:** Start MongoDB with `brew services start mongodb-community`

### JWT Token Invalid
```
{"success": false, "error": "Not authorized to access this route"}
```
**Solution:** Include token in Authorization header: `Bearer YOUR_TOKEN`

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Kill process on port 3000 or change PORT in .env

---

**Server Status:** Ready for development! 🚀
**MongoDB Required:** Yes (install and start before testing)
**Frontend Integration:** Ready (CORS enabled)
