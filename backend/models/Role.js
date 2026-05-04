import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

roleSchema.index({ name: 1 }, { unique: true });

export default mongoose.model("Role", roleSchema);
