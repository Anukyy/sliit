import { Router } from "express";
import bcrypt from "bcryptjs";
import AdminAccount from "../models/AdminAccount.js";
import { requireAdmin, signAdminToken } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const admin = await AdminAccount.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ token: signAdminToken(admin), username: admin.username });
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/change-password", requireAdmin, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    const admin = await AdminAccount.findById(req.admin.id);
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
