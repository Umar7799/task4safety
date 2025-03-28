const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config(); // Ensure dotenv is loaded

const app = express();
const server = http.createServer(app); // Needed for Socket.io
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000", // Local development (frontend)
      "http://localhost:5173", // Another local dev server, for example Vite
      "https://user-managmen.netlify.app" // Production URL on Netlify
    ],
    credentials: true, // Allow credentials such as cookies to be sent
    methods: ["GET", "POST"], // Allow these HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow Authorization header for socket connections
  },
});

// ✅ CORS Middleware Configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Local development (frontend)
      "http://localhost:5173", // Another local dev server, for example Vite
      "https://user-managmen.netlify.app" // Production URL on Netlify
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow the necessary HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Ensure Authorization header is allowed
    credentials: true, // Allow credentials such as cookies to be sent
  })
);

// ✅ Handle Preflight OPTIONS Requests
app.options("*", cors()); // This will handle preflight OPTIONS requests

app.use(express.json());

// ✅ Pool Configuration for PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render
  },
});
// ✅ Check Database Connection on Startup
pool.connect()
  .then(client => {
    console.log("✅ Connected to PostgreSQL database");
    client.release();
  })
  .catch(err => {
    console.error("❌ Database connection error:", err);
  });

module.exports = pool;

// ✅ Middleware for JWT Authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || "your_secret_key", (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token." });
    req.user = user;  // Add user info to request object
    next();
  });
};

// ✅ Middleware to check if a user is blocked
const checkIfBlocked = async (req, res, next) => {
  try {
    const userResult = await pool.query("SELECT status FROM users WHERE id = $1", [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    if (userResult.rows[0].status === "blocked") {
      return res.status(403).json({ error: "You are blocked. Action not allowed." });
    }

    next();
  } catch (error) {
    console.error("Error checking block status:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// ✅ Register a New User
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, status, last_login) VALUES ($1, $2, $3, 'active', NOW())",
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Email already exists." });
    }
    res.status(500).json({ error: "Could not register user." });
  }
});

// ✅ User Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: "Invalid email or password." });

    const user = userResult.rows[0];
    if (user.status === "blocked") return res.status(403).json({ error: "User is blocked." });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid email or password." });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: "1h" }
    );

    await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
    res.json({ message: "Login successful!", token });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ error: "Login failed." });
  }
});

// ✅ Get All Users
app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    const users = await pool.query("SELECT id, name, email, last_login, status FROM users ORDER BY last_login DESC");
    res.json({ users: users.rows });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Could not fetch users." });
  }
});

// ✅ Apply `checkIfBlocked` to action routes
app.put("/api/users/block/:id", authenticateToken, checkIfBlocked, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("UPDATE users SET status = 'blocked' WHERE id = $1 RETURNING *", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found." });

    const updatedUsers = await pool.query("SELECT id, name, email, last_login, status FROM users ORDER BY last_login DESC");
    io.emit("usersUpdated", updatedUsers.rows);

    res.json({ message: `User ${result.rows[0].name} has been blocked.` });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ error: "Could not block user." });
  }
});

app.put("/api/users/unblock/:id", authenticateToken, checkIfBlocked, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("UPDATE users SET status = 'active' WHERE id = $1 RETURNING *", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found." });

    const updatedUsers = await pool.query("SELECT id, name, email, last_login, status FROM users ORDER BY last_login DESC");
    io.emit("usersUpdated", updatedUsers.rows);

    res.json({ message: `User ${result.rows[0].name} has been unblocked.` });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ error: "Could not unblock user." });
  }
});

app.delete("/api/users/delete/:id", authenticateToken, checkIfBlocked, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found." });

    const updatedUsers = await pool.query("SELECT id, name, email, last_login, status FROM users ORDER BY last_login DESC");
    io.emit("usersUpdated", updatedUsers.rows);

    res.json({ message: `User ${result.rows[0].name} has been deleted.` });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Could not delete user." });
  }
});

// ✅ Start Server with WebSockets
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
