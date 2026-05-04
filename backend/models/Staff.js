import mongoose from "mongoose";

/** Portal logins use username + passwordHash; optional for non-portal directory entries */
const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    passwordHash: { type: String, default: "" },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

staffSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.model("Staff", staffSchema);
