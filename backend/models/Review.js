import mongoose from "mongoose";

/** Guest-facing: Rooms, Food, Staff, Cleanliness (legacy "other" kept for compatibility). */
export const REVIEW_CATEGORIES = ["room", "food", "staff", "other"];
export const REVIEW_STATUSES = ["active", "removed"];

const reviewSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerNumber: { type: Number, required: true, index: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    reviewerName: { type: String, default: "", trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: REVIEW_CATEGORIES, required: true, index: true },
    status: { type: String, enum: REVIEW_STATUSES, default: "active", index: true },
    removedReason: { type: String, default: "", trim: true, maxlength: 500 },
    removedByStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    managerUpdatedAt: { type: Date, default: null },
    /** Review Manager / admin response shown to guests when you expose it publicly. */
    adminReply: { type: String, default: "", trim: true, maxlength: 2000 },
    adminReplyAt: { type: Date, default: null },
    adminReplyByStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
