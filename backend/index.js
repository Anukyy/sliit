import "dotenv/config";
import mongoose from "mongoose";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { bootstrapData } from "./seed/bootstrap.js";

const app = createApp();

async function main() {
  let dbConnected = false;
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
    dbConnected = true;
    await bootstrapData();
  } catch (err) {
    console.error("MongoDB connection failed; starting API without DB.");
    console.error(err);
    console.error(
      "If you are using MongoDB Atlas and see 'querySrv', try a non-SRV connection string (mongodb://...) from Atlas, or change networks/DNS."
    );
  }

  /** Railway/cloud sets PORT exactly — do not hop ports in production. */
  const allowPortFallback =
    process.env.NODE_ENV !== "production" && !process.env.RAILWAY_ENVIRONMENT && !process.env.RENDER;

  const startServer = (port, attemptsLeft = 10) => {
    const server = app.listen(port, () => {
      const host = config.publicHost || "localhost";
      console.log(`API listening on port ${port} (PUBLIC_HOST=${host})`);
      if (!dbConnected) {
        console.log("DB: disconnected (some endpoints will fail until MongoDB connects)");
      }
    });

    server.on("error", (err) => {
      if (allowPortFallback && err?.code === "EADDRINUSE" && attemptsLeft > 0) {
        const nextPort = port + 1;
        console.warn(`Port ${port} in use; trying ${nextPort}...`);
        server.close(() => startServer(nextPort, attemptsLeft - 1));
        return;
      }
      throw err;
    });
  };

  startServer(config.port);
}

main().catch((err) => {
  console.error(err);
  console.error("Fatal startup error (API not running).");
});
