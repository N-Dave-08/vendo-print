import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import BackendRoutes from "./routes/backend_route.js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
// Import the USB detection service
import { initUsbDetectionService, getConnectedDrives, refreshDriveFiles } from "./services/usbDetectionService.js";

// For ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Increase payload limit for file uploads
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Configure CORS to allow all frontend origins including WebSocket
app.use(cors({
  origin: true, // Allow any origin in development
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Connection", "Upgrade", "Sec-WebSocket-Key", "Sec-WebSocket-Version"],
  credentials: true
}));

// Create uploads and temp directories if they don't exist
import fs from "fs";
const uploadsDir = path.join(__dirname, "uploads");
const tempDir = path.join(__dirname, "..", "temp");
const scansDir = path.join(__dirname, "printer", "scans");

[uploadsDir, tempDir, scansDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

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

// Add USB detection API endpoints
app.get("/api/usb-drives", (req, res) => {
  try {
    const drives = getConnectedDrives();
    res.json({ status: "success", drives });
  } catch (error) {
    console.error("Error getting USB drives:", error);
    res.status(500).json({ status: "error", message: "Failed to get USB drives" });
  }
});

app.get("/api/usb-drives/:drivePath/refresh", async (req, res) => {
  try {
    const drivePath = req.params.drivePath;
    const files = await refreshDriveFiles(drivePath);
    
    if (files === null) {
      return res.status(404).json({ status: "error", message: "Drive not found" });
    }
    
    res.json({ status: "success", files });
  } catch (error) {
    console.error("Error refreshing USB drive files:", error);
    res.status(500).json({ status: "error", message: "Failed to refresh USB drive files" });
  }
});

// Use default route
app.use("/api", BackendRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the VendoPrint server");
});

// Create HTTP server with increased timeout
const server = http.createServer(app);

// Increase timeout for the server to 5 minutes for long-running operations
server.timeout = 300000; // 5 minutes in milliseconds

// Initialize USB detection service with our server (now using an async IIFE)
(async () => {
  try {
    await initUsbDetectionService(server);
    // Keep this log since it's useful to know when the service is initialized
    console.log("USB detection service started");
  } catch (error) {
    console.error("Error starting USB detection service:", error);
  }
})();
 
// Use explicit port 5000 if not provided in env
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📄 API endpoint: http://localhost:${PORT}/api`);
  console.log(`⚙️ Server timeout set to ${server.timeout / 1000} seconds`);
  // Remove detailed WebSocket logging
  // console.log(`📀 USB detection active - WebSocket: ws://localhost:${PORT}`);
});


