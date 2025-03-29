const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config(); // Load environment variables

const app = express();
const server = http.createServer(app); // Required for WebSockets
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://user-managmen.netlify.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// ✅ Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://user-managmen.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.options("*", cors()); // Handle preflight requests
app.use(express.json());

// ✅ PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false, // Use secure SSL in production
});

// ✅ WebSocket Connection Handling
io.on("connection", (socket) => {
  console.log(`🔗 New client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ✅ Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || "your_secret_key", (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token." });
    req.user = user;
    next();
  });
};

// ✅ Check if User is Blocked
const checkIfBlocked = async (req, res, next) => {
  try {
    const userResult = await pool.query("SELECT status FROM users WHERE id = $1", [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found." });

    if (userResult.rows[0].status === "blocked") {
      return res.status(403).json({ error: "You are blocked. Action not allowed." });
    }

    next();
  } catch (error) {
    console.error("Error checking block status:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// ✅ User Registration
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "All fields are required." });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, status, last_login) VALUES ($1, $2, $3, 'active', NOW())",
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "23505") return res.status(409).json({ error: "Email already exists." });
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

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "your_secret_key", { expiresIn: "1h" });

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

// ✅ Blocking and Unblocking Users
app.put("/api/users/block/:id", authenticateToken, checkIfBlocked, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("UPDATE users SET status = 'blocked' WHERE id = $1 RETURNING *", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "User not found." });

    io.emit("usersUpdated");
    res.json({ message: `User has been blocked.` });
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

    io.emit("usersUpdated");
    res.json({ message: `User has been unblocked.` });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ error: "Could not unblock user." });
  }
});

// ✅ Start Server after DB Connection Test
const PORT = process.env.PORT || 5000;
pool.connect()
  .then(() => {
    console.log("✅ Database connected!");
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });
