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

          // React runtime must stay together.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }

          // First-load app framework / router.
          if (id.includes("/wouter/")) return "vendor-router";

          // Query/cache layer.
          if (id.includes("@tanstack")) return "vendor-query";

          // Icon pack.
          if (id.includes("lucide-react")) return "vendor-icons";

          // Form/validation libraries.
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("/zod/") ||
            id.includes("zod-validation-error")
          ) {
            return "vendor-forms";
          }

          // UI primitives/utilities.
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge") ||
            id.includes("/clsx/") ||
            id.includes("/cmdk/") ||
            id.includes("/vaul/") ||
            id.includes("embla-carousel")
          ) {
            return "vendor-ui-utils";
          }

          // Heavy visual libraries should never pollute the base app shell.
          if (id.includes("framer-motion")) return "vendor-motion";
          if (
            id.includes("recharts") ||
            id.includes("/d3-") ||
            id.includes("/d3/")
          ) {
            return "vendor-charts";
          }

          // Date helpers and misc libraries.
          if (id.includes("date-fns")) return "vendor-date";

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
