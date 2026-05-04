import mongoose from "mongoose";

/**
 * In-memory fallback for reviews when MongoDB is not available.
 * This keeps the app usable for demos (data resets on server restart).
 */

const store = {
  reviews: [],
};

function newId() {
  return String(new mongoose.Types.ObjectId());
}

function nowIso() {
  return new Date().toISOString();
}

export function addReview({
  customerId,
  customerNumber,
  customerEmail,
  reviewerName,
  rating,
  text,
  category,
}) {
  const doc = {
    _id: newId(),
    customer: customerId,
    customerNumber,
    customerEmail,
    reviewerName: reviewerName || "",
    rating,
    text,
    category,
    status: "active",
    removedReason: "",
    removedByStaff: null,
    managerUpdatedAt: null,
    adminReply: "",
    adminReplyAt: null,
    adminReplyByStaff: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.reviews.unshift(doc);
  return doc;
}

export function listPublicReviews({ category = "", limit = 30 } = {}) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 30));
  return store.reviews
    .filter((r) => r.status === "active")
    .filter((r) => (category ? String(r.category) === String(category) : true))
    .slice(0, lim);
}

export function listStaffReviews({ status = "", category = "", limit } = {}) {
  let out = [...store.reviews];
  if (status && status !== "all") out = out.filter((r) => r.status === status);
  if (category) out = out.filter((r) => r.category === category);
  if (limit !== undefined && limit !== "") {
    const lim = Math.min(5000, Math.max(1, Number(limit)));
    if (Number.isFinite(lim)) out = out.slice(0, lim);
  }
  return out;
}

export function getReviewById(id) {
  return store.reviews.find((r) => String(r._id) === String(id)) || null;
}

export function updateReview(id, patch) {
  const r = getReviewById(id);
  if (!r) return null;
  Object.assign(r, patch, { updatedAt: nowIso() });
  return r;
}

export function deleteReview(id) {
  const idx = store.reviews.findIndex((r) => String(r._id) === String(id));
  if (idx < 0) return null;
  const [deleted] = store.reviews.splice(idx, 1);
  return deleted || null;
}

export function analytics() {
  const all = [...store.reviews];
  const active = all.filter((r) => r.status === "active");
  const total = all.length;
  const activeCount = active.length;
  const removedCount = total - activeCount;
  const avgRating =
    activeCount > 0
      ? Number((active.reduce((s, r) => s + (Number(r.rating) || 0), 0) / activeCount).toFixed(2))
      : 0;

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

  return { total, activeCount, removedCount, avgRating, trend };
}

