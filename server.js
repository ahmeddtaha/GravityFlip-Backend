const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('./game.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Scores table
        db.run(`CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Create case-insensitive username index
        db.run(`CREATE INDEX IF NOT EXISTS idx_username_lower ON users(LOWER(username))`);
    });
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Check for existing username (case-insensitive)
        db.get('SELECT username FROM users WHERE LOWER(username) = LOWER(?)', [username], async (err, existingUser) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingUser) {
                return res.status(400).json({ error: 'Username already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
                [username, hashedPassword], 
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.status(201).json({ id: this.lastID, username });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        try {
            if (await bcrypt.compare(password, user.password)) {
                const token = jwt.sign(
                    { id: user.id, username: user.username },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                res.json({ token });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Error during authentication' });
        }
    });
});

app.post('/api/scores', authenticateToken, (req, res) => {
    const { score } = req.body;
    if (!score) {
        return res.status(400).json({ error: 'Score is required' });
    }

    db.run('INSERT INTO scores (user_id, score) VALUES (?, ?)',
        [req.user.id, score],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error saving score' });
            res.status(201).json({ id: this.lastID, score });
        }
    );
});

app.get('/api/leaderboard', (req, res) => {
    db.all(`
        SELECT u.username, MAX(s.score) as high_score
        FROM users u
        JOIN scores s ON u.id = s.user_id
        GROUP BY u.id
        ORDER BY high_score DESC
        LIMIT 10
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error fetching leaderboard' });
        res.json(rows);
    });
});

app.get('/api/user/scores', authenticateToken, (req, res) => {
    db.all('SELECT score, created_at FROM scores WHERE user_id = ? ORDER BY score DESC',
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error fetching user scores' });
            res.json(rows);
        }
    );
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 