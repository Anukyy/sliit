import mongoose from "mongoose";

export const NOTIFICATION_RECIPIENT_TYPES = ["customer", "staff", "admin"];

const notificationSchema = new mongoose.Schema(
  {
    recipientType: { type: String, enum: NOTIFICATION_RECIPIENT_TYPES, required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null, index: true },
    adminUsername: { type: String, default: "", trim: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    issueReport: { type: mongoose.Schema.Types.ObjectId, ref: "IssueReport", default: null, index: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
