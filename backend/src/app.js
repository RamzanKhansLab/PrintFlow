import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { apiRoutes } from "./routes/api.js";
import { sameOrigin } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";

export function createApp(dependencies) {
  const app = express();
  const { config } = dependencies;
  const dist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
  const index = path.join(dist, "index.html");
  if (config.production && !existsSync(index))
    throw new Error(
      "Missing frontend/dist/index.html. Run npm run build at the repository root",
    );
  if (config.production) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "upgrade-insecure-requests": config.production ? [] : null,
        },
      },
      strictTransportSecurity: config.production ? undefined : false,
    }),
  );
  app.use(sameOrigin, express.json({ limit: "100kb" }), cookieParser());
  app.use(
    "/api",
    (req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
    apiRoutes(dependencies),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API route not found" }),
  );
  app.use(express.static(dist, { index: false, maxAge: 0 }));
  app.get("/{*path}", (req, res) => {
    if (path.extname(req.path))
      return res.status(404).json({ error: "File not found" });
    if (!existsSync(index))
      return res
        .status(503)
        .type("text")
        .send(
          "Frontend is not built. Use the Vite dev server on port 5173 or run npm run build.",
        );
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(index);
  });
  app.use((req, res) => res.status(404).json({ error: "Route not found" }));
  app.use(errorHandler);
  return app;
}
