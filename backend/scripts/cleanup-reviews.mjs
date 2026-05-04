/**
 * Removes legacy AI/sentiment-related fields from Review documents.
 *
 * Usage:
 *   node scripts/cleanup-reviews.mjs
 */
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../config.js";
import Review from "../models/Review.js";

async function main() {
  console.log("Connecting MongoDB…");
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });

  const unset = {
    sentimentLabel: "",
    sentimentScore: "",
    mlTokens: "",
    cleanedPreview: "",
    sentimentPositivePct: "",
    sentimentNeutralPct: "",
    sentimentNegativePct: "",
  };

  const res = await Review.updateMany(
    {},
    {
      $unset: unset,
      $set: { category: "other" },
    }
  );

  console.log(`Reviews updated: matched=${res.matchedCount} modified=${res.modifiedCount}`);
  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

