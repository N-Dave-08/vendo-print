import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import BackendRoutes from "./routes/backend_route.js";


dotenv.config();

const app = express();


app.use(express.json({ limit: "Infinity" }));
app.use(express.urlencoded({ limit: "Infinity", extended: true }));

// More flexible CORS setup to support both development and production environments
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin) return callback(null, true);

    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',      // Local dev
      'http://192.168.1.14:5173',   // Local network dev
      'https://vendo-print.vercel.app', // Production
      /\.netlify\.app$/,           // Any Netlify deployment
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/ // Any Vercel deployment
    ];

    // Check if the origin is allowed
    let isAllowed = false;
    for (const allowed of allowedOrigins) {
      if (typeof allowed === 'string' && origin === allowed) {
        isAllowed = true;
        break;
      } else if (allowed instanceof RegExp && allowed.test(origin)) {
        isAllowed = true;
        break;
      }
    }

    if (isAllowed) {
      return callback(null, true);
    } else {
      console.log(`CORS blocked request from: ${origin}`);
      // Still allow the request to go through, but log it
      return callback(null, true);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cache-Control",
    "Pragma",
    "Expires"
  ],
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

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
  res.send("Welcome to the VendoPrint server - Document proxy and print service");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));


