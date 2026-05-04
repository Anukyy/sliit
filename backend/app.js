import path from "path";
import express from "express";
import cors from "cors";
import { registerRoutes } from "./registerRoutes.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  registerRoutes(app);
  return app;
}
