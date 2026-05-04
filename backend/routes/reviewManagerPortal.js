import { Router } from "express";
import mongoose from "mongoose";
import { requireReviewManager } from "../middleware/auth.js";
import Review, { REVIEW_CATEGORIES, REVIEW_STATUSES } from "../models/Review.js";
import { serverError } from "../lib/respond.js";
import { analytics as memAnalytics, deleteReview as memDelete, getReviewById, listStaffReviews, updateReview } from "../lib/inMemoryReviews.js";

const router = Router();

router.get("/reviews", requireReviewManager, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const status = String(req.query?.status || "").trim().toLowerCase();
      const category = String(req.query?.category || "").trim().toLowerCase();
      const rawLimit = req.query?.limit;
      if (status && status !== "all" && !REVIEW_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (category && !REVIEW_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const list = listStaffReviews({ status, category, limit: rawLimit });
      return res.json(list);
    }
    const status = String(req.query?.status || "").trim().toLowerCase();
    const category = String(req.query?.category || "").trim().toLowerCase();
    const filter = {};
    // Default: all reviews (active + removed). Pass ?status=active|removed to narrow.
    if (status && status !== "all") {
      if (!REVIEW_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
      filter.status = status;
    }
    if (category) {
      if (!REVIEW_CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category" });
      filter.category = category;
    }
    let q = Review.find(filter)
      .sort({ createdAt: -1 })
      .populate("customer", "name email customerNumber profileFirstName profileLastName")
      .populate("adminReplyByStaff", "name username");
    const rawLimit = req.query?.limit;
    if (rawLimit !== undefined && rawLimit !== "") {
      const limit = Math.min(5000, Math.max(1, Number(rawLimit)));
      if (!Number.isFinite(limit)) return res.status(400).json({ error: "Invalid limit" });
      q = q.limit(limit);
    }
    const list = await q.lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/reviews/analytics", requireReviewManager, async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        ...memAnalytics(),
        byCategory: REVIEW_CATEGORIES.map((category) => {
          const rows = listStaffReviews({ status: "active", category });
          return {
            category,
            count: rows.length,
            avgRating: rows.length
              ? Number((rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / rows.length).toFixed(2))
              : 0,
          };
        }),
        categoryCounts: {
          roomReviewsCount: listStaffReviews({ status: "active", category: "room" }).length,
          foodReviewsCount: listStaffReviews({ status: "active", category: "food" }).length,
          staffReviewsCount: listStaffReviews({ status: "active", category: "staff" }).length,
          otherReviewsCount: listStaffReviews({ status: "active", category: "other" }).length,
        },
      });
    }
    const all = await Review.find().lean();
    const active = all.filter((r) => r.status === "active");
    const total = all.length;
    const activeCount = active.length;
    const removedCount = total - activeCount;
    const avgRating = activeCount > 0 ? Number((active.reduce((s, r) => s + (Number(r.rating) || 0), 0) / activeCount).toFixed(2)) : 0;

    const byCategory = REVIEW_CATEGORIES.map((category) => {
      const rows = active.filter((r) => r.category === category);
      return {
        category,
        count: rows.length,
        avgRating: rows.length ? Number((rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(2)) : 0,
      };
    });

    const roomReviewsCount = active.filter((r) => r.category === "room").length;
    const foodReviewsCount = active.filter((r) => r.category === "food").length;
    const staffReviewsCount = active.filter((r) => r.category === "staff").length;
    const otherReviewsCount = active.filter((r) => r.category === "other").length;

    const trendMap = new Map();
    for (let i = 29; i >= 0; i -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      trendMap.set(key, { date: key, count: 0, avgRating: 0, _sum: 0 });
    }
    for (const row of active) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      const entry = trendMap.get(key);
      if (!entry) continue;
      entry.count += 1;
      entry._sum += Number(row.rating) || 0;
    }
    const trend = [...trendMap.values()].map((d) => ({
      date: d.date,
      count: d.count,
      avgRating: d.count ? Number((d._sum / d.count).toFixed(2)) : 0,
    }));

    res.json({
      total,
      activeCount,
      removedCount,
      avgRating,
      byCategory,
      trend,
      categoryCounts: {
        roomReviewsCount,
        foodReviewsCount,
        staffReviewsCount,
        otherReviewsCount,
      },
    });
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/reviews/:id", requireReviewManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid review id" });
    if (mongoose.connection.readyState !== 1) {
      const review = getReviewById(id);
      if (!review) return res.status(404).json({ error: "Review not found" });

      const raw = req.body && typeof req.body === "object" ? req.body : {};
      const keys = Object.keys(raw).filter((k) => raw[k] !== undefined);
      if (keys.length === 0) return res.status(400).json({ error: "No update fields provided" });

      const patch = {};
      if (raw.status !== undefined) {
        const status = String(raw.status).trim();
        if (!REVIEW_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid review status" });
        patch.status = status;
        if (status === "removed") {
          patch.removedByStaff = req.staffAuth.id;
          patch.removedReason = String(raw.removedReason || "").trim();
        } else {
          patch.removedByStaff = null;
          patch.removedReason = "";
        }
      }
      if (raw.rating !== undefined) {
        const rating = Number(raw.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return res.status(400).json({ error: "Rating must be 1 to 5" });
        }
        patch.rating = rating;
      }
      if (raw.adminReply !== undefined) {
        patch.adminReply = String(raw.adminReply || "").trim().slice(0, 2000);
        patch.adminReplyAt = patch.adminReply ? new Date().toISOString() : null;
        patch.adminReplyByStaff = patch.adminReply ? req.staffAuth.id : null;
      }
      patch.managerUpdatedAt = new Date().toISOString();
      const updated = updateReview(id, patch);
      return res.json(updated);
    }
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ error: "Review not found" });

    const raw = req.body && typeof req.body === "object" ? req.body : {};
    const keys = Object.keys(raw).filter((k) => raw[k] !== undefined);
    if (keys.length === 0) {
      return res.status(400).json({ error: "No update fields provided" });
    }

    if (raw.status !== undefined) {
      const status = String(raw.status).trim();
      if (!REVIEW_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid review status" });
      review.status = status;
      if (status === "removed") {
        review.removedByStaff = req.staffAuth.id;
        review.removedReason = String(raw.removedReason || "").trim();
      } else {
        review.removedByStaff = null;
        review.removedReason = "";
      }
    }

    if (raw.rating !== undefined) {
      const rating = Number(raw.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be 1 to 5" });
      }
      review.rating = rating;
    }

    if (raw.adminReply !== undefined) {
      review.adminReply = String(raw.adminReply || "").trim().slice(0, 2000);
      review.adminReplyAt = review.adminReply ? new Date() : null;
      review.adminReplyByStaff = review.adminReply ? req.staffAuth.id : null;
    }

    review.managerUpdatedAt = new Date();
    await review.save();
    const out = await Review.findById(review._id)
      .populate("customer", "name email customerNumber profileFirstName profileLastName")
      .populate("adminReplyByStaff", "name username")
      .lean();
    res.json(out);
  } catch (err) {
    serverError(res, err);
  }
});

router.delete("/reviews/:id", requireReviewManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid review id" });
    if (mongoose.connection.readyState !== 1) {
      const deleted = memDelete(id);
      if (!deleted) return res.status(404).json({ error: "Review not found" });
      return res.json({ ok: true });
    }
    const deleted = await Review.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Review not found" });
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
