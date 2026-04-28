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
        /**
         * TCD_STAGE_31_NO_VENDOR_CORE_FIRST_LOAD
         *
         * Do NOT return a catch-all vendor-core chunk.
         * A catch-all vendor chunk forces lazy-route dependencies into the first page load.
         * Only split known shared packages. Let Rollup keep route-only packages with lazy chunks.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "vendor-react";
          }

          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("wouter")) return "vendor-router";

          // These should only load when a route/component actually needs them.
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("/zod/") ||
            id.includes("zod-validation-error")
          ) {
            return "vendor-forms";
          }
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts") || id.includes("/d3-")) return "vendor-charts";

          return undefined;
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
