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
  origin: "http://localhost:5173",  
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));


// app.use(cors)

// Use default route
app.use("/api", BackendRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the Firebase-integrated server");
});

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


