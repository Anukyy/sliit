import { Router } from "express";
import Staff from "../models/Staff.js";
import Role from "../models/Role.js";
import ShiftSchedule from "../models/ShiftSchedule.js";
import { requireAdmin } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();
router.use(requireAdmin);

/** Matches portal manager titles in seed (`bootstrap.js` CORE_MANAGER_ROLES). */
const PORTAL_MANAGER_ROLE_NAMES = [
  "Room Manager",
  "Kitchen Manager",
  "Review Manager",
  "Customer Manager",
];

router.get("/summary", async (_req, res) => {
  try {
    const [staffTotal, staffActive, roleCountAll, rolesManagers, shiftCount] = await Promise.all([
      Staff.countDocuments(),
      Staff.countDocuments({ active: true }),
      Role.countDocuments(),
      Role.countDocuments({ name: { $in: PORTAL_MANAGER_ROLE_NAMES } }),
      ShiftSchedule.countDocuments(),
    ]);
    res.json({
      staff: { total: staffTotal, active: staffActive },
      /** All Role documents (includes Receptionist, etc.). */
      roles: roleCountAll,
      /** Portal manager role kinds present — expected up to 4 after bootstrap. */
      rolesManagers,
      shifts: shiftCount,
    });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
