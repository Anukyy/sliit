import mongoose from "mongoose";

export const ROOM_STATUSES = ["Available", "Reserved", "Occupied", "Cleaning", "Maintenance"];

export const ROOM_VARIANTS = ["Standard", "King", "Deluxe", "Duplex", "Suite"];

const roomPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    originalName: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, trim: true, unique: true },
    floor: { type: Number, default: 1 },
    variant: { type: String, enum: ROOM_VARIANTS, required: true },
    roomType: { type: String, default: "Standard Room", trim: true },
    airConditioned: { type: Boolean, default: true },
    description: { type: String, default: "", trim: true },
    capacity: { type: Number, default: 2, min: 1 },
    basePricePerNight: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ROOM_STATUSES,
      default: "Available",
    },
    photos: { type: [roomPhotoSchema], default: [] },
    amenities: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

roomSchema.index({ status: 1 });

export default mongoose.model("Room", roomSchema);
