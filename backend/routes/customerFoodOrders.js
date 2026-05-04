import { Router } from "express";
import mongoose from "mongoose";
import FoodItem from "../models/FoodItem.js";
import FoodOrder from "../models/FoodOrder.js";
import { requireCustomer } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.post("/food-orders", requireCustomer, async (req, res) => {
  try {
    const rawLines = req.body?.lines;
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return res.status(400).json({ error: "Add at least one item to your order" });
    }

    const lines = [];
    for (const row of rawLines) {
      const id = String(row?.foodItemId ?? row?.foodItem ?? "").trim();
      const qty = Math.floor(Number(row?.quantity));
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid menu item" });
      }
      if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: "Each quantity must be between 1 and 99" });
      }
      const item = await FoodItem.findOne({ _id: id, active: true }).lean();
      if (!item) {
        return res.status(400).json({ error: "A menu item is no longer available" });
      }
      const unitPrice = Math.round(Number(item.price) || 0);
      lines.push({
        foodItem: item._id,
        name: item.name,
        unitPrice,
        quantity: qty,
      });
    }

    const subtotal = lines.reduce((sum, L) => sum + L.unitPrice * L.quantity, 0);

    const doc = await FoodOrder.create({
      customer: req.customer.id,
      lines,
      subtotal,
      orderStatus: "received",
    });

    const populated = await FoodOrder.findById(doc._id).populate("lines.foodItem", "name").lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
