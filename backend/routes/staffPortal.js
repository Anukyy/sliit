import { Router } from "express";
import bcrypt from "bcryptjs";
import Staff from "../models/Staff.js";
import { requireStaff, signStaffToken } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const staff = await Staff.findOne({ username, active: true }).populate("role");
    if (!staff || !staff.passwordHash || !(await bcrypt.compare(password, staff.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({
      token: signStaffToken(staff),
      username: staff.username,
      name: staff.name,
      roleName: staff.role?.name || "",
    });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/me", requireStaff, async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffAuth.id).populate("role").lean();
    if (!staff || !staff.active) {
      return res.status(404).json({ error: "Staff not found" });
    }
    delete staff.passwordHash;
    res.json(staff);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
