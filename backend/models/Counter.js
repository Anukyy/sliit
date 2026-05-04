import mongoose from "mongoose";

/** Atomic sequence for guest customer numbers (e.g. MV-10001). */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.model("Counter", counterSchema);
