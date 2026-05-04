import mongoose from "mongoose";

export const FOOD_CATEGORIES = ["breakfast", "main", "dessert", "bevarages", "kottu", "snacks"];

const foodItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    category: { type: String, enum: FOOD_CATEGORIES, default: "main", index: true },
  },
  { timestamps: true }
);

foodItemSchema.index({ active: 1, category: 1, name: 1 });

export default mongoose.model("FoodItem", foodItemSchema);
