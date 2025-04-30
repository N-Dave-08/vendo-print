import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import BackendRoutes from "./routes/backend_route.js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
// Import the USB detection service
import { initUsbDetectionService, getConnectedDrives, refreshDriveFiles } from "./services/usbDetectionService.js";
import axios from "axios";

// For ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:5173', // Frontend URL
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Use backend routes
app.use('/api', BackendRoutes);

// Initialize USB detection service
console.log('Initializing USB detection service...');
const wss = await initUsbDetectionService(server);

// Log system information
console.log('System Information:');
console.log(`- Architecture: ${process.arch}`);
console.log(`- Platform: ${process.platform}`);
console.log(`- Node Version: ${process.version}`);
console.log(`- Process running as 64-bit: ${process.env.PROCESSOR_ARCHITECTURE === 'AMD64'}`);

if (wss) {
  console.log('✅ USB detection service initialized successfully');
} else {
  console.error('❌ Failed to initialize USB detection service');
}

// Add USB detection API endpoints with better error handling
app.get("/api/usb-drives", (req, res) => {
  try {
    const drives = getConnectedDrives();
    console.log('📂 Retrieved USB drives:', drives);
    res.json({ status: "success", drives });
  } catch (error) {
    console.error("❌ Error getting USB drives:", error);
    res.status(500).json({ status: "error", message: "Failed to get USB drives" });
  }
});

app.get("/api/usb-drives/:drivePath/refresh", async (req, res) => {
  try {
    const drivePath = req.params.drivePath;
    console.log('🔄 Refreshing drive:', drivePath);
    
    const files = await refreshDriveFiles(drivePath);
    
    if (files === null) {
      console.error('❌ Drive not found:', drivePath);
      return res.status(404).json({ status: "error", message: "Drive not found" });
    }
    
    console.log(`✅ Successfully refreshed drive. Found ${files.length} files`);
    res.json({ status: "success", files });
  } catch (error) {
    console.error("❌ Error refreshing USB drive files:", error);
    res.status(500).json({ status: "error", message: "Failed to refresh USB drive files" });
  }
});

// Add proxy-pdf endpoint
app.get("/api/proxy-pdf", async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    console.log("Proxying PDF request for:", url);

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Forward the content type
    res.setHeader('Content-Type', response.headers['content-type']);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // Pipe the response
    response.data.pipe(res);
  } catch (error) {
    console.error("Error proxying PDF:", error);
    res.status(500).json({ error: "Failed to proxy PDF" });
  }
});

// Start the server
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


