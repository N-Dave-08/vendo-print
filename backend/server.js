import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import BackendRoutes from "./routes/backend_route.js";


dotenv.config();

const app = express();


app.use(express.json({ limit: "Infinity" }));
app.use(express.urlencoded({ limit: "Infinity", extended: true }));

// app.use(cors({
//   origin: "https://vendo-print.vercel.app",  
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   allowedHeaders: ["Content-Type"],
// }));

app.use(cors({
  origin: ["http://localhost:5173", "http://192.168.1.14:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
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

// app.use(cors)

// Use default route
app.use("/api", BackendRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the Firebase-integrated server");
});

const PORT = process.env.PORT;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));


