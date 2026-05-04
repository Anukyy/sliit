import mongoose from "mongoose";

export const FOOD_PAYMENT_METHODS = ["room_bill", "online", "cash"];
export const FOOD_PAYMENT_STATUSES = ["pending", "paid"];
export const FOOD_ORDER_STATUSES = ["received", "preparing", "ready", "completed", "cancelled"];
export const FOOD_SETTLEMENT_METHODS = ["cash", "card", "online"];

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
    /** Set when guest completes room booking and links this room-bill order */
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    lines: { type: [orderLineSchema], required: true, validate: [(v) => Array.isArray(v) && v.length > 0, "lines"] },
    subtotal: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: FOOD_PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: FOOD_PAYMENT_STATUSES, default: "pending" },
    settledVia: { type: String, enum: FOOD_SETTLEMENT_METHODS, default: null },
    settledAt: { type: Date, default: null },
    orderStatus: { type: String, enum: FOOD_ORDER_STATUSES, default: "received" },
  },
  { timestamps: true }
);

foodOrderSchema.index({ createdAt: -1 });

export default mongoose.model("FoodOrder", foodOrderSchema);
