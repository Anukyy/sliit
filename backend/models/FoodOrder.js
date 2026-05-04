import mongoose from "mongoose";

export const FOOD_ORDER_STATUSES = ["received", "preparing", "ready", "completed", "cancelled"];

const orderLineSchema = new mongoose.Schema(
  {
    foodItem: { type: mongoose.Schema.Types.ObjectId, ref: "FoodItem", required: true },
    name: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const foodOrderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    lines: { type: [orderLineSchema], required: true, validate: [(v) => Array.isArray(v) && v.length > 0, "lines"] },
    subtotal: { type: Number, required: true, min: 0 },
    orderStatus: { type: String, enum: FOOD_ORDER_STATUSES, default: "received" },
  },
  { timestamps: true }
);

foodOrderSchema.index({ createdAt: -1 });

export default mongoose.model("FoodOrder", foodOrderSchema);
