# Gravity Flip Game Server
This is the backend server for the Gravity Flip Unity game. It provides user authentication, score tracking, and leaderboard functionality.

## Setup

1. Install dependencies:
npm install


2. Start the server:
npm start


## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login and get JWT token

### Scores
- `POST /api/scores` - Submit a new score (requires authentication)
- `GET /api/leaderboard` - Get top 10 scores
- `GET /api/user/scores` - Get user's score history (requires authentication)

## Database Schema

### Users Table
- id (INTEGER, PRIMARY KEY)
- username (TEXT, UNIQUE)
- password (TEXT)
- created_at (DATETIME)

### Scores Table
- id (INTEGER, PRIMARY KEY)
- user_id (INTEGER, FOREIGN KEY)
- score (INTEGER)
- created_at (DATETIME)
