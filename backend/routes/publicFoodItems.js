import { Router } from "express";
import FoodItem, { FOOD_CATEGORIES } from "../models/FoodItem.js";
import { serverError } from "../lib/respond.js";

const router = Router();

function normalizeCategory(raw, fallback = "main") {
  const value = String(raw ?? "").trim().toLowerCase();
  return FOOD_CATEGORIES.includes(value) ? value : fallback;
}

router.get("/food-items", async (_req, res) => {
  try {
    const list = await FoodItem.find({ active: true }).lean();
    res.json(
      list.map((item) => ({
        ...item,
        category: normalizeCategory(item.category),
      }))
    );
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
