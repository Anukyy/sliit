import mongoose from "mongoose";

export const ISSUE_TYPES = ["plumbing", "ac", "electrical"];
export const ISSUE_PRIORITIES = ["low", "medium", "high"];
export const ISSUE_STATUSES = ["submitted", "assigned", "in_progress", "resolved"];

const issueReportSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    issueType: { type: String, enum: ISSUE_TYPES, required: true, index: true },
    priority: { type: String, enum: ISSUE_PRIORITIES, required: true, index: true },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    status: { type: String, enum: ISSUE_STATUSES, default: "submitted", index: true },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null, index: true },
    assignedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

issueReportSchema.index({ createdAt: -1 });

export default mongoose.model("IssueReport", issueReportSchema);
