const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Apply Security and Request Handling Middlewares
app.use(cors());
app.use(express.json());

// 1. Database Connection Configuration (With Guaranteed Hardcoded Fallbacks)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'xwz_parking_db'
});

db.connect((err) => {
    if (err) {
        console.error('CRITICAL: MySQL Connection failed! Description: ' + err.stack);
        console.log('\n--> Pro-Tip: Make sure XAMPP / MySQL Server is running and database "xwz_parking_db" is created.');
        return;
    }
    console.log('SUCCESS: Connected to MySQL Database cleanly.');
});

// 2. JWT Access Token Verification Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Access Denied: Missing Security Token' });
    }
    
    const secretKey = process.env.JWT_SECRET || 'XWZ_SUPER_SECRET_KEY_2026';
    jwt.verify(token, secretKey, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ message: 'Access Denied: Expired or Invalid Token' });
        }
        req.user = decodedUser;
        next();
    });
};

// =========================================================================
// 3. AUTHENTICATION MICROSERVICE ENDPOINTS (Register & Login)
// =========================================================================

// Driver Register Template Endpoint
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, password, role, phone_number } = req.body;

    if (!full_name || !email || !password || !phone_number) {
        return res.status(400).json({ message: 'Validation Error: Please fill all required fields.' });
    }

    try {
        // Securely hash the plain text password input parameters
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        const sqlInsert = 'INSERT INTO users (full_name, email, password_hash, role, phone_number) VALUES (?, ?, ?, ?, ?)';
        db.query(sqlInsert, [full_name, email, password_hash, role || 'Driver', phone_number], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Conflict: This email address is already registered.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'Registration completed successfully!' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error during password hashing execution.' });
    }
});

// Driver Profile Login/Sign In Endpoint
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Validation Error: Email and password parameters are required.' });
    }

    const sqlSelect = 'SELECT * FROM users WHERE email = ?';
    db.query(sqlSelect, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials provided.' });

        const user = results[0];
        
        // Match incoming plain text password with stored database hash string
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials provided.' });

        // Sign and build JWT session token
        const secretKey = process.env.JWT_SECRET || 'XWZ_SUPER_SECRET_KEY_2026';
        const token = jwt.sign(
            { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
            secretKey,
            { expiresIn: '3h' }
        );

        res.json({
            message: 'Login step authorized successfully.',
            token,
            user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
        });
    });
});

// =========================================================================
// 4. PARKING MANAGEMENT ENDPOINTS (Core Business Workflows)
// =========================================================================

// Read all active locations and live spaces status counts
app.get('/api/parking/locations', (req, res) => {
    db.query('SELECT * FROM parking_locations', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Process a New Space Transaction Reservation Booking
app.post('/api/parking/book', authenticateToken, (req, res) => {
    const { location_id, plate_number, duration_minutes, fee_paid } = req.body;
    const user_id = req.user.id;

    if (!location_id || !plate_number || !duration_minutes) {
        return res.status(400).json({ message: 'Missing parameters needed to process booking.' });
    }

    // Atomically verify if target location terminal has available spaces remaining
    db.query('SELECT available_spaces FROM parking_locations WHERE id = ?', [location_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Location terminal entry not found.' });

        if (results[0].available_spaces <= 0) {
            return res.status(400).json({ message: 'Booking rejected: Selected zone is completely filled.' });
        }

        // Action Step 1: Insert new row inside the duration tracking table
        const sqlInsertBooking = 'INSERT INTO bookings (user_id, location_id, plate_number, duration_minutes, fee_paid) VALUES (?, ?, ?, ?, ?)';
        db.query(sqlInsertBooking, [user_id, location_id, plate_number, duration_minutes, fee_paid || 0], (err, bookingResult) => {
            if (err) return res.status(500).json({ error: err.message });

            // Action Step 2: Deduct open space inventory tracker flag count at target location
            db.query('UPDATE parking_locations SET available_spaces = available_spaces - 1 WHERE id = ?', [location_id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Parking space locked and checked in successfully.', bookingId: bookingResult.insertId });
            });
        });
    });
});

// Read active duration history records for the authenticated driver
app.get('/api/parking/my-bookings', authenticateToken, (req, res) => {
    const sqlQuery = `
        SELECT b.*, l.location_name, l.type 
        FROM bookings b 
        JOIN parking_locations l ON b.location_id = l.id 
        WHERE b.user_id = ? 
        ORDER BY b.start_time DESC`;

    db.query(sqlQuery, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Analytics Dashboard Endpoint: Computes total cars present and municipal tracking counts
app.get('/api/parking/realtime-report', (req, res) => {
    const sqlSummary = `
        SELECT 
            (SELECT COUNT(*) FROM bookings WHERE status = 'Active') as active_parked_cars,
            (SELECT COALESCE(SUM(fee_paid), 0) FROM bookings) as total_revenue_collected,
            (SELECT COUNT(*) FROM users WHERE role = 'Driver') as registered_drivers`;

    db.query(sqlSummary, (err, summaryResults) => {
        if (err) return res.status(500).json({ error: err.message });

        const sqlBreakdown = 'SELECT location_name, total_spaces, available_spaces, (total_spaces - available_spaces) as cars_present FROM parking_locations';
        db.query(sqlBreakdown, (err, locationStats) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                summary: summaryResults[0],
                locationBreakdown: locationStats
            });
        });
    });
});

// 5. Start Backend Server Instance
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`XWZ Microservices application platform started cleanly.`);
    console.log(`Listening on connection port routing address: ${PORT}`);
    console.log(`=======================================================`);
});