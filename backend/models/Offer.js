import mongoose from "mongoose";

const offerPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    originalName: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    photos: { type: [offerPhotoSchema], default: [] },
    rooms: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }],
      validate: {
        validator(rooms) {
          return Array.isArray(rooms) && rooms.length >= 2;
        },
        message: "An offer must include at least two rooms",
      },
    },
    /** Bundle price in LKR shown to guests (optional display; 0 = show as “see front desk” or omit) */
    packagePrice: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

offerSchema.index({ active: 1, updatedAt: -1 });

export default mongoose.model("Offer", offerSchema);
