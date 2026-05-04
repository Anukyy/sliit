import { Router } from "express";
import ShiftSchedule from "../models/ShiftSchedule.js";
import { requireAdmin } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const shifts = await ShiftSchedule.find().populate("staff").sort({ startAt: -1 });
    res.json(shifts);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/", async (req, res) => {
  try {
    const { staff, startAt, endAt, label, notes } = req.body;
    if (!staff || !startAt || !endAt) {
      return res.status(400).json({ error: "staff, startAt, and endAt are required" });
    }
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: "Invalid date range" });
    }
    const shift = await ShiftSchedule.create({
      staff,
      startAt: start,
      endAt: end,
      label: label ? String(label).trim() : "",
      notes: notes ? String(notes).trim() : "",
    });
    await shift.populate("staff");
    res.status(201).json(shift);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const updates = {};
    if (req.body.staff != null) updates.staff = req.body.staff;
    if (req.body.startAt != null) updates.startAt = new Date(req.body.startAt);
    if (req.body.endAt != null) updates.endAt = new Date(req.body.endAt);
    if (req.body.label !== undefined) updates.label = String(req.body.label).trim();
    if (req.body.notes !== undefined) updates.notes = String(req.body.notes).trim();

    const shift = await ShiftSchedule.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("staff");
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    if (shift.endAt <= shift.startAt) {
      return res.status(400).json({ error: "endAt must be after startAt" });
    }
    res.json(shift);
  } catch (err) {
    serverError(res, err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await ShiftSchedule.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Shift not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
