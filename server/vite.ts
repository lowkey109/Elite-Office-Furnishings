import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import path from "path";
import { nanoid } from "nanoid";

import fsp from "fs/promises";
import { existsSync } from "fs";

const PROJECT_ROOT: string = existsSync(path.resolve(process.cwd(), "client", "index.html"))
  ? process.cwd()
  : existsSync(path.resolve(process.cwd(), "workspace", "client", "index.html"))
    ? path.resolve(process.cwd(), "workspace")
    : "/home/runner/workspace";

const fromRoot = (...parts: string[]): string => path.resolve(PROJECT_ROOT, ...parts);






const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = fromRoot("client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fsp.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
