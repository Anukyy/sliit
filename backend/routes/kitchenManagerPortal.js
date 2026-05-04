import { Router } from "express";
import mongoose from "mongoose";
import FoodItem, { FOOD_CATEGORIES } from "../models/FoodItem.js";
import FoodOrder, { FOOD_ORDER_STATUSES } from "../models/FoodOrder.js";
import { requireKitchenManager } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

function normalizeCategory(raw, fallback = "main") {
  const value = String(raw ?? "").trim().toLowerCase();
  return FOOD_CATEGORIES.includes(value) ? value : fallback;
}

function parseCategory(raw) {
  const category = String(raw ?? "").trim().toLowerCase();
  return FOOD_CATEGORIES.includes(category) ? category : null;
}

function parseOrderStatus(raw) {
  const status = String(raw ?? "").trim();
  return FOOD_ORDER_STATUSES.includes(status) ? status : null;
}

function isInvalidId(id) {
  return !mongoose.isValidObjectId(id);
}

function populateFoodOrder(query) {
  return query.populate("customer", "email customerNumber").populate("lines.foodItem", "name category");
}

router.get("/kitchen/food-items", requireKitchenManager, async (_req, res) => {
  try {
    const list = await FoodItem.find().sort({ createdAt: -1 }).lean();
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

router.post("/kitchen/food-items", requireKitchenManager, async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const description = String(req.body?.description ?? "").trim();
    const price = Math.round(Number(req.body?.price));
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Valid price (LKR) is required" });
    }
    const category = parseCategory(req.body?.category);
    if (!category) {
      return res.status(400).json({ error: `category must be one of: ${FOOD_CATEGORIES.join(", ")}` });
    }
    const doc = await FoodItem.create({
      name,
      description,
      price,
      active: req.body?.active === false ? false : true,
      category,
    });
    const out = await FoodItem.findById(doc._id).lean();
    res.status(201).json(out);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/kitchen/food-items/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (isInvalidId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const item = await FoodItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      item.name = name;
    }
    if (req.body?.description !== undefined) {
      item.description = String(req.body.description).trim();
    }
    if (req.body?.price !== undefined) {
      const price = Math.round(Number(req.body.price));
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: "Invalid price" });
      }
      item.price = price;
    }
    if (req.body?.active !== undefined) {
      item.active = Boolean(req.body.active);
    }
    if (req.body?.category !== undefined) {
      const category = parseCategory(req.body.category);
      if (!category) {
        return res.status(400).json({ error: `category must be one of: ${FOOD_CATEGORIES.join(", ")}` });
      }
      item.category = category;
    }
    await item.save();
    const out = await FoodItem.findById(item._id).lean();
    res.json(out);
  } catch (err) {
    serverError(res, err);
  }
});

router.delete("/kitchen/food-items/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (isInvalidId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const item = await FoodItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }
    await item.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/kitchen/food-orders", requireKitchenManager, async (_req, res) => {
  try {
    const list = await populateFoodOrder(FoodOrder.find().sort({ createdAt: -1 })).lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/kitchen/food-orders/:id", requireKitchenManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (isInvalidId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const order = await FoodOrder.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (req.body?.orderStatus !== undefined) {
      const next = parseOrderStatus(req.body.orderStatus);
      if (!next) {
        return res.status(400).json({ error: "Invalid order status" });
      }
      order.orderStatus = next;
    }
    await order.save();
    const populated = await populateFoodOrder(FoodOrder.findById(order._id)).lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
