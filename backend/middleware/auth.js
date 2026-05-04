/** JWT auth: Bearer tokens, role guards (`require*`). Secrets from `config.js`. */

import jwt from "jsonwebtoken";
import { config } from "../config.js";
import Staff from "../models/Staff.js";
import Customer from "../models/Customer.js";

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: String(admin._id), username: admin.username, type: "admin" },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function signCustomerToken(customer) {
  return jwt.sign(
    {
      sub: String(customer._id),
      type: "customer",
      email: customer.email,
      customerNumber: customer.customerNumber,
    },
    config.jwtSecret,
    { expiresIn: "30d" }
  );
}

export function signStaffToken(staff) {
  const roleName =
    staff.role && typeof staff.role === "object" && staff.role.name ? staff.role.name : "";
  return jwt.sign(
    {
      sub: String(staff._id),
      username: staff.username,
      type: "staff",
      name: staff.name,
      roleName,
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function parseBearer(req) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function normalizeRoleName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
}

function hasAllowedRole(staffRoleName, allowedRoleNames) {
  const normalized = normalizeRoleName(staffRoleName);
  return allowedRoleNames.map(normalizeRoleName).includes(normalized);
}

/**
 * Valid staff JWT → populated active Staff, or a structured failure for HTTP response.
 */
async function authenticateActiveStaff(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return { ok: false, status: 401, body: { error: "Invalid or expired token" } };
  }
  if (payload.type !== "staff") {
    return { ok: false, status: 403, body: { error: "Staff access required" } };
  }
  const staff = await Staff.findById(payload.sub).populate("role");
  if (!staff || !staff.active) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  return { ok: true, staff };
}

export function requireAdmin(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.type !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.admin = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireStaff(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.type !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    req.staffAuth = { id: payload.sub, username: payload.username, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Guest JWT + active Customer account */
export async function requireCustomer(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.type !== "customer") {
      return res.status(403).json({ error: "Guest sign-in required" });
    }
    const customer = await Customer.findById(payload.sub).lean();
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.customer = {
      id: String(customer._id),
      email: customer.email,
      customerNumber: customer.customerNumber,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function attachStaffAuth(req, staff) {
  req.staffAuth = { id: String(staff._id), username: staff.username, name: staff.name };
}

async function requireStaffRole(req, res, next, allowedAliases, roleLabel, extra) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const result = await authenticateActiveStaff(token);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }
  const { staff } = result;
  if (!hasAllowedRole(staff.role?.name, allowedAliases)) {
    return res.status(403).json({ error: `${roleLabel} access required` });
  }
  attachStaffAuth(req, staff);
  if (extra?.attachRoomManagerStaff) {
    req.roomManagerStaff = staff;
  }
  next();
}

export async function requireCustomerManager(req, res, next) {
  await requireStaffRole(req, res, next, ["Customer Manager", "customer_manager"], "Customer Manager");
}

export async function requireKitchenManager(req, res, next) {
  await requireStaffRole(req, res, next, ["Kitchen Manager", "kitchen_manager"], "Kitchen Manager");
}

export async function requireReceptionist(req, res, next) {
  await requireStaffRole(req, res, next, ["Receptionist", "receptionist"], "Receptionist");
}

export async function requireRoomManager(req, res, next) {
  await requireStaffRole(req, res, next, ["Room Manager", "room_manager"], "Room Manager", {
    attachRoomManagerStaff: true,
  });
}

export async function requireReviewManager(req, res, next) {
  await requireStaffRole(req, res, next, ["Review Manager", "review_manager"], "Review Manager");
}
