import { Router } from "express";
import bcrypt from "bcryptjs";
import Customer from "../models/Customer.js";
import Counter from "../models/Counter.js";
import { requireCustomer, signCustomerToken } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(raw) {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required" };
  if (email.length > EMAIL_MAX) return { error: "Email is too long" };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
  return { email };
}

function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 128) return "Password must be at most 128 characters";
  if (!/[a-zA-Z]/.test(p)) return "Password must include at least one letter";
  if (!/[0-9]/.test(p)) return "Password must include at least one number";
  return null;
}

function validateName(raw) {
  const name = String(raw ?? "").trim();
  if (!name) return { error: "Name is required" };
  if (name.length < 2) return { error: "Name must be at least 2 characters" };
  if (name.length > 120) return { error: "Name is too long" };
  return { name };
}

function normalizePhoneDigits(raw) {
  let phone = String(raw ?? "").replace(/\D/g, "");
  if (phone.length === 9 && /^7\d{8}$/.test(phone)) {
    phone = `0${phone}`;
  }
  return phone;
}

function validatePhone(raw) {
  const phone = normalizePhoneDigits(raw);
  if (!phone) return { error: "Phone is required" };
  if (phone.length !== 10) {
    return {
      error: "Phone must be 10 digits including leading 0 (e.g. 0712345678)",
    };
  }
  return { phone };
}

async function nextCustomerNumber() {
  const doc = await Counter.findOneAndUpdate(
    { _id: "customer" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

function customerPublic(c) {
  return {
    _id: c._id,
    customerNumber: c.customerNumber,
    name: c.name,
    phone: c.phone,
    email: c.email,
    profileFirstName: c.profileFirstName || "",
    profileLastName: c.profileLastName || "",
    profileMobile: c.profileMobile || "",
    profileServiceUrl: c.profileServiceUrl || "",
    profilePhotoUrl: c.profilePhotoUrl || "",
    preferredRoomType: c.preferredRoomType || "",
    preferredFood: c.preferredFood || "",
    loyaltyPoints: Number(c.loyaltyPoints) || 0,
    createdAt: c.createdAt,
  };
}

router.post("/register", async (req, res) => {
  try {
    const vn = validateName(req.body?.name);
    if (vn.error) return res.status(400).json({ error: vn.error });
    const vp = validatePhone(req.body?.phone);
    if (vp.error) return res.status(400).json({ error: vp.error });
    const ve = validateEmail(req.body?.email);
    if (ve.error) return res.status(400).json({ error: ve.error });
    const pwdErr = validatePassword(req.body?.password);
    if (pwdErr) return res.status(400).json({ error: pwdErr });
    if (String(req.body?.confirmPassword ?? "") !== String(req.body?.password ?? "")) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const exists = await Customer.findOne({ email: ve.email });
    if (exists?.active) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(String(req.body.password), 10);

    if (exists && !exists.active) {
      exists.name = vn.name;
      exists.phone = vp.phone;
      exists.passwordHash = passwordHash;
      exists.active = true;
      exists.deletedAt = null;
      exists.deletedReason = "";
      await exists.save();
      return res.status(201).json({
        token: signCustomerToken(exists),
        customer: customerPublic(exists),
      });
    }

    const customer = await Customer.create({
      name: vn.name,
      phone: vp.phone,
      email: ve.email,
      passwordHash,
      customerNumber: await nextCustomerNumber(),
    });

    res.status(201).json({
      token: signCustomerToken(customer),
      customer: customerPublic(customer),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    serverError(res, err);
  }
});

router.post("/login", async (req, res) => {
  try {
    const ve = validateEmail(req.body?.email);
    if (ve.error) {
      return res.status(400).json({ error: ve.error });
    }
    const password = String(req.body?.password ?? "");
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const customer = await Customer.findOne({ email: ve.email });
    if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!customer.active) {
      return res.status(403).json({ error: "This account has been disabled. Contact the hotel." });
    }

    res.json({
      token: signCustomerToken(customer),
      customer: customerPublic(customer),
    });
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id).lean();
    if (!customer || !customer.active) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json(customerPublic(customer));
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
