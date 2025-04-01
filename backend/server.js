import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import BackendRoutes from "./routes/backend_route.js";
import path from "path";
import { fileURLToPath } from "url";

// For ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Increase payload limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Configure CORS to allow all frontend origins
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:5000", "http://192.168.1.14:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

// Create uploads and temp directories if they don't exist
import fs from "fs";
const uploadsDir = path.join(__dirname, "uploads");
const tempDir = path.join(__dirname, "..", "temp");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created uploads directory: ${uploadsDir}`);
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`Created temp directory: ${tempDir}`);
}

// Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`📥 ${req.method} ${req.url} - Request received`);

  // Log request body for POST/PUT requests
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    // Don't log full file data if present
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.fileUrl) {
      sanitizedBody.fileUrl = '[FILE URL REDACTED FOR LOGGING]';
    }
    console.log(`📦 Request body: ${JSON.stringify(sanitizedBody)}`);
  }

  // Track response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    console.log(`📤 ${req.method} ${req.url} - Response sent (${res.statusCode}) [${duration}ms]`);
    return originalSend.apply(res, arguments);
  };

  next();
});

// Use default route
app.use("/api", BackendRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the VendoPrint server");
});

// Use explicit port 5000 if not provided in env
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📄 API endpoint: http://localhost:${PORT}/api`);
});


