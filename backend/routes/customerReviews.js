import { Router } from "express";
import mongoose from "mongoose";
import { requireCustomer } from "../middleware/auth.js";
import Review from "../models/Review.js";
import { serverError } from "../lib/respond.js";
import { addReview, listStaffReviews, updateReview } from "../lib/inMemoryReviews.js";

const router = Router();

function normalizeReviewInput(body) {
  const text = String(body?.text ?? "").trim();
  const rating = Number(body?.rating);
  const reviewerName = String(body?.reviewerName ?? "").trim();
  return { text, rating, category: "other", reviewerName };
}

function validateReviewInput({ text, rating, category, reviewerName }) {
  if (!text) return "Review text is required";
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) return "Review text must be at least 5 words";
  if (text.length > 2000) return "Review text must be at most 2000 characters";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Rating must be 1 to 5";
  if (reviewerName.length > 80) return "Reviewer name must be at most 80 characters";
  return "";
}

router.get("/reviews", requireCustomer, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const list = listStaffReviews({ status: "active" }).filter((r) => String(r.customer) === String(req.customer.id));
      return res.json(list.slice(0, 200));
    }
    const list = await Review.find({ customer: req.customer.id, status: "active" })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/reviews", requireCustomer, async (req, res) => {
  try {
    const input = normalizeReviewInput(req.body);
    const validationError = validateReviewInput(input);
    if (validationError) return res.status(400).json({ error: validationError });

    if (mongoose.connection.readyState !== 1) {
      const tenMinAgo = Date.now() - 10 * 60 * 1000;
      const duplicate = listStaffReviews({ status: "active" }).find(
        (r) =>
          String(r.customer) === String(req.customer.id) &&
          String(r.text) === String(input.text) &&
          String(r.category) === String(input.category) &&
          new Date(r.createdAt).getTime() >= tenMinAgo
      );
      if (duplicate) {
        return res.status(409).json({ error: "Duplicate review detected. Please edit your existing review." });
      }
      const created = addReview({
        customerId: req.customer.id,
        customerNumber: req.customer.customerNumber,
        customerEmail: req.customer.email,
        reviewerName: input.reviewerName,
        rating: input.rating,
        text: input.text,
        category: input.category,
      });
      return res.status(201).json(created);
    }

    const duplicate = await Review.findOne({
      customer: req.customer.id,
      text: input.text,
      category: input.category,
      status: "active",
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    }).lean();
    if (duplicate) {
      return res.status(409).json({ error: "Duplicate review detected. Please edit your existing review." });
    }

    const created = await Review.create({
      customer: req.customer.id,
      customerNumber: req.customer.customerNumber,
      customerEmail: req.customer.email,
      reviewerName: input.reviewerName,
      rating: input.rating,
      text: input.text,
      category: input.category,
    });
    res.status(201).json(created);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/reviews/:id", requireCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid review id" });
    if (mongoose.connection.readyState !== 1) {
      const rating = Number(req.body?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be 1 to 5" });
      }
      const updated = updateReview(id, { rating });
      if (!updated || String(updated.customer) !== String(req.customer.id) || updated.status !== "active") {
        return res.status(404).json({ error: "Review not found" });
      }
      return res.json(updated);
    }

    const review = await Review.findById(id);
    if (!review || review.status !== "active") return res.status(404).json({ error: "Review not found" });
    if (String(review.customer) !== req.customer.id) return res.status(403).json({ error: "You can only edit your own review" });

    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be 1 to 5" });
    }

    review.rating = rating;
    await review.save();
    res.json(review);
  } catch (err) {
    serverError(res, err);
  }
});

router.delete("/reviews/:id", requireCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid review id" });
    if (mongoose.connection.readyState !== 1) {
      const existing = updateReview(id, { status: "removed", removedReason: "Removed by guest" });
      if (!existing || String(existing.customer) !== String(req.customer.id) || existing.status !== "removed") {
        return res.status(404).json({ error: "Review not found" });
      }
      return res.json({ ok: true });
    }
    const review = await Review.findById(id);
    if (!review || review.status !== "active") return res.status(404).json({ error: "Review not found" });
    if (String(review.customer) !== req.customer.id) return res.status(403).json({ error: "You can only delete your own review" });

    review.status = "removed";
    review.removedReason = "Removed by guest";
    await review.save();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
