import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    assignedRole: {
      type: String,
      enum: ["plumber", "room_helper", "electrician", ""],
      default: "",
      trim: true,
    },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
    },
    scheduledFor: { type: Date, default: null },
  },
  { timestamps: true }
);

maintenanceSchema.index({ room: 1, createdAt: -1 });

export default mongoose.model("MaintenanceRecord", maintenanceSchema);
