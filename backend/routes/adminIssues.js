import { Router } from "express";
import mongoose from "mongoose";
import { requireAdmin } from "../middleware/auth.js";
import IssueReport, { ISSUE_STATUSES } from "../models/IssueReport.js";
import Staff from "../models/Staff.js";
import Notification from "../models/Notification.js";
import { notifyCustomer, notifyStaff } from "../services/notifications.js";
import { serverError } from "../lib/respond.js";

const router = Router();
router.use(requireAdmin);

router.get("/issues", async (_req, res) => {
  try {
    const [issues, staff] = await Promise.all([
      IssueReport.find()
        .sort({ createdAt: -1 })
        .populate("customer", "email customerNumber")
        .populate("room", "roomNumber")
        .populate("assignedStaff", "name username role")
        .lean(),
      Staff.find({ active: true }).populate("role").sort({ name: 1 }).lean(),
    ]);
    res.json({
      issues,
      assignableStaff: staff.map((s) => ({
        _id: s._id,
        name: s.name,
        username: s.username,
        roleName: s.role?.name || "",
      })),
    });
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/issues/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid issue id" });
    const issue = await IssueReport.findById(id).populate("room", "roomNumber");
    if (!issue) return res.status(404).json({ error: "Issue not found" });

    const nextStatus = req.body?.status;
    const nextStaff = req.body?.assignedStaff;
    const changes = [];

    if (nextStatus !== undefined) {
      if (!ISSUE_STATUSES.includes(nextStatus)) return res.status(400).json({ error: "Invalid status" });
      issue.status = nextStatus;
      if (nextStatus === "resolved") issue.resolvedAt = new Date();
      if (nextStatus !== "resolved") issue.resolvedAt = null;
      changes.push(`status changed to ${nextStatus}`);
    }

    if (nextStaff !== undefined) {
      if (nextStaff === null || nextStaff === "") {
        issue.assignedStaff = null;
      } else {
        if (!mongoose.isValidObjectId(String(nextStaff))) return res.status(400).json({ error: "Invalid staff id" });
        const staff = await Staff.findById(nextStaff).lean();
        if (!staff || !staff.active) return res.status(404).json({ error: "Assigned staff not found" });
        issue.assignedStaff = staff._id;
        issue.assignedByAdmin = req.admin.id;
        if (issue.status === "submitted") issue.status = "assigned";
        await notifyStaff(
          staff._id,
          "Issue assigned to you",
          `Room ${issue.room?.roomNumber || "?"} issue has been assigned by admin.`,
          issue._id
        );
        changes.push("staff assigned");
      }
    }

    await issue.save();

    if (changes.length > 0) {
      await notifyCustomer(
        issue.customer,
        "Issue update",
        `Your issue for room ${issue.room?.roomNumber || "?"} was updated: ${changes.join(", ")}.`,
        issue._id
      );
    }

    const populated = await IssueReport.findById(issue._id)
      .populate("customer", "email customerNumber")
      .populate("room", "roomNumber")
      .populate("assignedStaff", "name username role")
      .lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/notifications", async (_req, res) => {
  try {
    const list = await Notification.find({ recipientType: "admin", adminUsername: req.admin.username })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
