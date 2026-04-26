#!/bin/bash

echo "🧹 Cleaning server/index.ts merge conflict..."

# 1. remove conflict markers
sed -i '/^<<<<<<< /d' server/index.ts
sed -i '/^=======/d' server/index.ts
sed -i '/^>>>>>>>/d' server/index.ts

# 2. remove duplicate imports
awk '!seen[$0]++' server/index.ts > tmp.ts && mv tmp.ts server/index.ts

# 3. hard reset to clean minimal working server
cat > server/index.ts << 'CODE'
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
CODE

echo "✅ index.ts repaired"
