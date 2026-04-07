import express from "express";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";

import path from "path"

const __dirname = new URL('.', import.meta.url).pathname

app.use(express.static(path.join(__dirname, "../dist/public")))

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/public/index.html"))
})

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// API routes
registerRoutes(app);

// Serve frontend
const frontendPath = path.join(process.cwd(), "dist/public");

app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
