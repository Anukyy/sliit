import { Router } from "express";
import FoodItem, { FOOD_CATEGORIES } from "../models/FoodItem.js";
import { serverError } from "../lib/respond.js";

const router = Router();
const rank = new Map(FOOD_CATEGORIES.map((name, idx) => [name, idx]));

function normalizeCategory(raw, fallback = "main") {
  const value = String(raw ?? "").trim().toLowerCase();
  return FOOD_CATEGORIES.includes(value) ? value : fallback;
}

router.get("/food-items", async (_req, res) => {
  try {
    const list = await FoodItem.find({ active: true }).lean();
    list.sort((a, b) => {
      const ca = rank.get(normalizeCategory(a.category));
      const cb = rank.get(normalizeCategory(b.category));
      if ((ca ?? 9999) !== (cb ?? 9999)) return (ca ?? 9999) - (cb ?? 9999);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
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
