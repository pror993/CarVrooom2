const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'CarVrooom API Server is running!' });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/agentic', require('./routes/agentic')); // Agentic AI orchestration
app.use('/api/ueba', require('./routes/ueba')); // UEBA monitoring
app.use('/api/llm', require('./routes/llmTest')); // Temporary test route

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚗 CarVrooom server running on port ${PORT}`);
});
