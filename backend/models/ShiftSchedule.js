import mongoose from "mongoose";

const shiftScheduleSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    label: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("ShiftSchedule", shiftScheduleSchema);
