import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const rootDir = __dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "client", "src"),
      "@shared": path.resolve(rootDir, "shared"),
      "@assets": path.resolve(rootDir, "attached_assets"),
    },
  },
  root: path.resolve(rootDir, "client"),
  build: {
    outDir: path.resolve(rootDir, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // Keep React together.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "vendor-react";
          }

          // Split common large libraries so one monster vendor file is avoided.
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("zod")) return "vendor-zod";
          if (id.includes("stripe") || id.includes("@stripe")) return "vendor-stripe";
          if (id.includes("cmdk")) return "vendor-cmdk";
          if (id.includes("embla")) return "vendor-carousel";
          if (id.includes("class-variance-authority") || id.includes("clsx") || id.includes("tailwind-merge")) {
            return "vendor-ui-utils";
          }

          return "vendor-core";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
