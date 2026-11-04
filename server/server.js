const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const routes = require("./routes/routes");
const { startReminders } = require("./utils/reminders");

const server = express();
const PORT = process.env.PORT || 8000;

// Middleware
server.use(express.json());

// Session setup (login is remembered with a session cookie).
// Sessions are kept in MongoDB, so restarting the server doesn't log everyone out.
server.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.DB }),
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// API routes
server.use(routes);

// Unknown API routes
server.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found." });
});

// In production, serve the built Vue app (run `pnpm build` in the project root first).
// During development the Vite dev server serves the app instead.
const distPath = path.join(__dirname, "..", "dist");
server.use(express.static(distPath));
server.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
});

// Connect to MongoDB then start server
async function connectDB() {
    try {
        await mongoose.connect(process.env.DB);
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

function startServer() {
    server.listen(PORT, () => {
        console.log(`API running on http://localhost:${PORT}`);
    });
}

if (require.main === module) {
    connectDB().then(() => {
        startServer();
        // Meetup reminders: checked every minute while the server runs
        startReminders();
    });
}

module.exports = server;
