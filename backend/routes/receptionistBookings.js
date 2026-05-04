import { Router } from "express";
import Booking from "../models/Booking.js";
import { requireReceptionist } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.get("/bookings", requireReceptionist, async (_req, res) => {
  try {
    const list = await Booking.find()
      .sort({ createdAt: -1 })
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber roomType variant")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
