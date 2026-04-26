import express from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";

const app = express();
const server = createServer(app);

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// routes
registerRoutes(server, app);

// start server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
