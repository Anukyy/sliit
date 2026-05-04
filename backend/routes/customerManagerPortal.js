import { Router } from "express";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import IssueReport, { ISSUE_STATUSES } from "../models/IssueReport.js";
import Booking from "../models/Booking.js";
import FoodOrder from "../models/FoodOrder.js";
import Notification from "../models/Notification.js";
import Counter from "../models/Counter.js";
import bcrypt from "bcryptjs";
import { requireCustomerManager } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

async function nextCustomerNumber() {
  const doc = await Counter.findOneAndUpdate(
    { _id: "customer" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

router.get("/customers", requireCustomerManager, async (_req, res) => {
  try {
    const list = await Customer.find().select("-passwordHash").sort({ customerNumber: 1 }).lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/customers", requireCustomerManager, async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const phone = String(req.body?.phone ?? "").replace(/\D/g, "");
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: "name, phone, email, and password are required" });
    }
    if (phone.length !== 10) {
      return res.status(400).json({ error: "Phone must be exactly 10 digits" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const customerNumber = await nextCustomerNumber();
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await Customer.create({
      name,
      phone,
      email,
      passwordHash,
      customerNumber,
      preferredRoomType: String(req.body?.preferredRoomType ?? "").trim().slice(0, 80),
      preferredFood: String(req.body?.preferredFood ?? "").trim().slice(0, 120),
      loyaltyPoints: Math.max(0, Number(req.body?.loyaltyPoints) || 0),
    });
    const lean = await Customer.findById(created._id).select("-passwordHash").lean();
    res.status(201).json(lean);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Customer email already exists" });
    }
    serverError(res, err);
  }
});

router.patch("/customers/:id", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (req.body?.active !== undefined) {
      customer.active = Boolean(req.body.active);
    }
    if (req.body?.name !== undefined) {
      customer.name = String(req.body.name ?? "").trim().slice(0, 120);
    }
    if (req.body?.phone !== undefined) {
      const phone = String(req.body.phone ?? "").replace(/\D/g, "");
      if (phone.length !== 10) {
        return res.status(400).json({ error: "Phone must be exactly 10 digits" });
      }
      customer.phone = phone;
    }
    if (req.body?.email !== undefined) {
      customer.email = String(req.body.email ?? "").trim().toLowerCase();
    }
    if (req.body?.preferredRoomType !== undefined) {
      customer.preferredRoomType = String(req.body.preferredRoomType ?? "").trim().slice(0, 80);
    }
    if (req.body?.preferredFood !== undefined) {
      customer.preferredFood = String(req.body.preferredFood ?? "").trim().slice(0, 120);
    }
    if (req.body?.loyaltyPoints !== undefined) {
      customer.loyaltyPoints = Math.max(0, Number(req.body.loyaltyPoints) || 0);
    }
    await customer.save();
    const lean = await Customer.findById(customer._id).select("-passwordHash").lean();
    res.json(lean);
  } catch (err) {
    serverError(res, err);
  }
});

router.delete("/customers/:id", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    customer.active = false;
    customer.deletedAt = new Date();
    customer.deletedReason = "customer_manager_removed";
    await customer.save();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

router.delete("/customers/:id/preferences", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    customer.preferredRoomType = "";
    customer.preferredFood = "";
    await customer.save();
    const lean = await Customer.findById(customer._id).select("-passwordHash").lean();
    res.json(lean);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/customers/:id/loyalty-points", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const delta = Math.round(Number(req.body?.pointsDelta));
    if (!Number.isFinite(delta)) {
      return res.status(400).json({ error: "pointsDelta is required" });
    }
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    customer.loyaltyPoints = Math.max(0, (Number(customer.loyaltyPoints) || 0) + delta);
    await customer.save();
    const lean = await Customer.findById(customer._id).select("-passwordHash").lean();
    res.json(lean);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/customers/:id/details", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const customer = await Customer.findById(id).select("-passwordHash").lean();
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const [bookings, foodOrders, issues, notifications] = await Promise.all([
      Booking.find({ customer: customer._id }).sort({ createdAt: -1 }).populate("room", "roomNumber").lean(),
      FoodOrder.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
      IssueReport.find({ customer: customer._id })
        .sort({ createdAt: -1 })
        .populate("room", "roomNumber")
        .populate("assignedStaff", "name username")
        .lean(),
      Notification.find({ recipientType: "customer", customer: customer._id })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);
    const bookingTotal = bookings.reduce((sum, b) => sum + (Math.round(Number(b.totalAmount) || 0)), 0);
    const foodTotal = foodOrders.reduce((sum, o) => sum + (Math.round(Number(o.subtotal) || 0)), 0);
    res.json({
      customer,
      bookings,
      foodOrders,
      issues,
      notifications,
      invoices: {
        bookingTotal,
        foodTotal,
        grandTotal: bookingTotal + foodTotal,
      },
    });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/issues", requireCustomerManager, async (_req, res) => {
  try {
    const list = await IssueReport.find()
      .sort({ createdAt: -1 })
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber")
      .populate("assignedStaff", "name username")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/issues/:id", requireCustomerManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const issue = await IssueReport.findById(id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    const status = String(req.body?.status || "").trim();
    if (!ISSUE_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
    issue.status = status;
    if (status === "resolved") issue.resolvedAt = new Date();
    if (status !== "resolved") issue.resolvedAt = null;
    await issue.save();
    const populated = await IssueReport.findById(issue._id)
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber")
      .populate("assignedStaff", "name username")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
