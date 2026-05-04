/**
 * End-to-end check: guest review POST → public list → staff dashboard list.
 * Run with API up: `node scripts/verify-review-flow.mjs`
 * Uses BASE_URL (default http://127.0.0.1:5000/api).
 */
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../config.js";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import Counter from "../models/Counter.js";
import Customer from "../models/Customer.js";
import bcrypt from "bcryptjs";

const BASE = process.env.VERIFY_API_BASE || "http://127.0.0.1:5000/api";

async function http(method, path, { headers = {}, body } = {}) {
  const url = `${BASE}${path}`;
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function nextCustomerNumber() {
  const doc = await Counter.findOneAndUpdate({ _id: "customer" }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
}

async function main() {
  const stamp = Date.now();
  const email = `rv_verify_${stamp}@example.com`;
  const password = "Testpass1";

  console.log("Connecting MongoDB for booking seed…");
  await mongoose.connect(config.mongoUri);

  const passwordHash = await bcrypt.hash(password, 10);
  const customerNumber = await nextCustomerNumber();
  const customer = await Customer.create({
    name: "Review Verify",
    phone: "0712345678",
    email,
    passwordHash,
    customerNumber,
  });

  const room = await Room.findOne().select("_id").lean();
  if (!room) {
    throw new Error("No room in DB — run bootstrap first.");
  }

  const checkIn = new Date("2026-05-01T12:00:00.000Z");
  const checkOut = new Date("2026-05-14T12:00:00.000Z");
  const booking = await Booking.create({
    customer: customer._id,
    bookingType: "room",
    room: room._id,
    checkIn,
    checkOut,
    nights: 13,
    fullName: "Review Verify",
    contactEmail: email,
    phone: "0712345678",
    roomSubtotal: 10000,
    mealSubtotal: 0,
    taxRate: 0.12,
    taxAmount: 1200,
    totalAmount: 11200,
    advanceAmount: 5000,
    remainingAmount: 6200,
    advancePaid: true,
    balancePaid: true,
    status: "confirmed",
    checkedInAt: new Date(),
    checkedOutAt: null,
  });

  await mongoose.disconnect();
  console.log("Created customer + in-stay booking:", String(customer._id), String(booking._id));

  console.log("POST /customer-auth/login …");
  const login = await http("POST", "/customer-auth/login", {
    body: { email, password },
  });
  if (login.status !== 200 || !login.data?.token) {
    console.error(login);
    throw new Error("Login failed");
  }
  const custToken = login.data.token;

  const reviewBody = {
    text: "This is a verification review with enough words for the hotel policy rules here.",
    rating: 5,
    reviewerName: "Verify Guest",
    category: "other",
  };

  console.log("POST /customer-auth/reviews …");
  const created = await http("POST", "/customer-auth/reviews", {
    headers: { Authorization: `Bearer ${custToken}` },
    body: reviewBody,
  });
  if (created.status !== 201) {
    console.error(created);
    throw new Error("Review create failed");
  }
  const reviewId = created.data?._id;
  console.log("Created review:", reviewId);

  console.log("GET /public/reviews …");
  const pub = await http("GET", "/public/reviews?limit=100");
  if (pub.status !== 200 || !Array.isArray(pub.data)) {
    console.error(pub);
    throw new Error("Public reviews failed");
  }
  const inPublic = pub.data.some((r) => String(r._id) === String(reviewId));
  console.log(inPublic ? "PASS: review appears on public/landing list." : "FAIL: review missing from public list.");

  console.log("POST /staff-portal/login (review_manager) …");
  const staffLogin = await http("POST", "/staff-portal/login", {
    body: { username: "review_manager", password: "review_manager123" },
  });
  if (staffLogin.status !== 200 || !staffLogin.data?.token) {
    console.error(staffLogin);
    throw new Error("Staff login failed");
  }
  const staffToken = staffLogin.data.token;

  console.log("GET /staff-portal/reviews …");
  const dash = await http("GET", "/staff-portal/reviews", {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  if (dash.status !== 200 || !Array.isArray(dash.data)) {
    console.error(dash);
    throw new Error("Staff reviews failed");
  }
  const inDash = dash.data.some((r) => String(r._id) === String(reviewId));
  console.log(inDash ? "PASS: review appears on Review Manager dashboard list." : "FAIL: review missing from staff list.");

  if (!inPublic || !inDash) {
    process.exitCode = 1;
  } else {
    console.log("\nAll checks OK.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
