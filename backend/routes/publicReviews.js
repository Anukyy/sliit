import { Router } from "express";
import mongoose from "mongoose";
import Review, { REVIEW_CATEGORIES } from "../models/Review.js";
import { serverError } from "../lib/respond.js";
import { listPublicReviews } from "../lib/inMemoryReviews.js";

const router = Router();

router.get("/reviews", async (req, res) => {
  try {
    const category = String(req.query?.category || "").trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 30));
    const filter = { status: "active" };
    if (category) {
      if (!REVIEW_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      filter.category = category;
    }
    if (mongoose.connection.readyState !== 1) {
      return res.json(listPublicReviews({ category, limit }));
    }
    const list = await Review.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
