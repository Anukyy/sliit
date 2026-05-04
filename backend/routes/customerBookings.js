import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import FoodOrder from "../models/FoodOrder.js";
import FoodItem from "../models/FoodItem.js";
import Room from "../models/Room.js";
import Offer from "../models/Offer.js";
import { requireCustomer } from "../middleware/auth.js";
import { serverError } from "../lib/respond.js";

const router = Router();

export const ADVANCE_LKR = 5000;
export const TAX_RATE = 0.12;
export const MAX_STAY_NIGHTS = 60;

async function buildFoodLinesFromPendingRequest(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "Restaurant selection is empty" };
  }
  const qtyById = new Map();
  for (const row of rawLines) {
    const id = String(row?.foodItemId ?? row?.foodItem ?? "").trim();
    const qty = Math.floor(Number(row?.quantity));
    if (!mongoose.isValidObjectId(id)) return { error: "Invalid menu item in restaurant selection" };
    if (!Number.isFinite(qty) || qty < 1) return { error: "Each food quantity must be between 1 and 99" };
    qtyById.set(id, Math.min(99, (qtyById.get(id) || 0) + qty));
  }
  const lines = [];
  for (const [id, qty] of qtyById.entries()) {
    const item = await FoodItem.findOne({ _id: id, active: true }).lean();
    if (!item) return { error: "A menu item is no longer available" };
    lines.push({ foodItem: item._id, name: item.name, unitPrice: Math.round(Number(item.price) || 0), quantity: qty });
  }
  if (lines.length === 0) return { error: "Restaurant selection is empty" };
  return { lines, subtotal: lines.reduce((sum, L) => sum + L.unitPrice * L.quantity, 0) };
}

function parseDateOnly(s) {
  const str = String(s ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nightsBetween(checkIn, checkOut) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

router.get("/bookings", requireCustomer, async (req, res) => {
  try {
    const list = await Booking.find({ customer: req.customer.id })
      .sort({ createdAt: -1 })
      .populate("room", "roomNumber roomType variant basePricePerNight")
      .populate("offer", "title packagePrice")
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/bookings", requireCustomer, async (req, res) => {
  try {
    const roomId = req.body?.roomId ? String(req.body.roomId).trim() : "";
    const offerId = req.body?.offerId ? String(req.body.offerId).trim() : "";
    if ((!roomId && !offerId) || (roomId && offerId)) {
      return res.status(400).json({ error: "Provide exactly one of roomId or offerId" });
    }
    const checkInD = parseDateOnly(req.body?.checkIn);
    const checkOutD = parseDateOnly(req.body?.checkOut);
    if (!checkInD || !checkOutD || checkOutD <= checkInD) {
      return res.status(400).json({ error: "Valid checkIn/checkOut dates are required and checkout must be later" });
    }
    const nights = nightsBetween(checkInD, checkOutD);
    if (nights > MAX_STAY_NIGHTS) {
      return res.status(400).json({ error: `Maximum stay is ${MAX_STAY_NIGHTS} nights.` });
    }

    const fullName = String(req.body?.fullName ?? "").trim();
    const contactEmail = String(req.body?.contactEmail ?? "").trim().toLowerCase();
    const phone = String(req.body?.phone ?? "").trim().replace(/\D/g, "");
    const address = String(req.body?.address ?? "").trim();
    const specialRequests = String(req.body?.specialRequests ?? "").trim();
    if (!fullName || !contactEmail || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Valid fullName, contactEmail and 10-digit phone are required" });
    }
    const advanceAck = req.body?.advanceAcknowledged === true || req.body?.advanceAcknowledged === "true";
    if (!advanceAck) {
      return res.status(400).json({ error: "You must confirm the compulsory advance payment of LKR 5,000" });
    }

    let bookingType;
    let room = null;
    let offer = null;
    let roomSubtotal = 0;
    let summaryLine = "";
    if (roomId) {
      if (!mongoose.isValidObjectId(roomId)) return res.status(400).json({ error: "Invalid room" });
      room = await Room.findById(roomId).lean();
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (room.status !== "Available") return res.status(400).json({ error: `Room ${room.roomNumber} is currently ${room.status}.` });
      const overlap = await Booking.exists({ room: room._id, status: { $ne: "cancelled" }, checkIn: { $lt: checkOutD }, checkOut: { $gt: checkInD } });
      if (overlap) return res.status(400).json({ error: "This room is already reserved for the selected dates." });
      bookingType = "room";
      roomSubtotal = Math.round(Number(room.basePricePerNight) || 0) * nights;
      summaryLine = `Room ${room.roomNumber} · ${nights} night(s)`;
    } else {
      if (!mongoose.isValidObjectId(offerId)) return res.status(400).json({ error: "Invalid offer" });
      offer = await Offer.findOne({ _id: offerId, active: true }).populate("rooms", "basePricePerNight").lean();
      if (!offer) return res.status(404).json({ error: "Offer not found or inactive" });
      bookingType = "offer";
      const pkg = Number(offer.packagePrice) || 0;
      roomSubtotal = pkg > 0 ? Math.round(pkg * nights) : Math.round((offer.rooms || []).reduce((a, r) => a + (Number(r.basePricePerNight) || 0), 0) * nights);
      summaryLine = `${offer.title} · ${nights} night(s)`;
    }

    const mealSubtotal = 0;
    const taxAmount = Math.round((roomSubtotal + mealSubtotal) * TAX_RATE);
    const roomPackageTotal = roomSubtotal + mealSubtotal + taxAmount;
    const restaurantFolio = Math.round(Number(req.body?.restaurantFolioSubtotal)) || 0;
    let linkedIds = Array.isArray(req.body?.linkedFoodOrderIds)
      ? [...new Set(req.body.linkedFoodOrderIds.map((x) => String(x ?? "").trim()).filter((id) => mongoose.isValidObjectId(id)))]
      : [];

    if (Array.isArray(req.body?.pendingFoodLines) && req.body.pendingFoodLines.length > 0) {
      if (linkedIds.length > 0) return res.status(400).json({ error: "Use linked food orders OR pending restaurant lines, not both" });
      const built = await buildFoodLinesFromPendingRequest(req.body.pendingFoodLines);
      if (built.error) return res.status(400).json({ error: built.error });
      if (Math.round(Number(built.subtotal)) !== restaurantFolio) return res.status(400).json({ error: "Restaurant folio total mismatch" });
      const doc = await FoodOrder.create({ customer: req.customer.id, lines: built.lines, subtotal: built.subtotal, orderStatus: "received" });
      linkedIds = [String(doc._id)];
    }

    if (restaurantFolio > 0 && linkedIds.length === 0) return res.status(400).json({ error: "Linked food orders are required when including restaurant charges" });
    if (restaurantFolio === 0 && linkedIds.length > 0) return res.status(400).json({ error: "Remove linked food orders or set a restaurant folio total" });
    if (linkedIds.length > 0) {
      const orders = await FoodOrder.find({ _id: { $in: linkedIds } }).lean();
      if (orders.length !== linkedIds.length) return res.status(400).json({ error: "One or more food orders were not found" });
      let linkedOrderSum = 0;
      for (const o of orders) {
        if (String(o.customer) !== String(req.customer.id)) return res.status(403).json({ error: "Invalid food order reference" });
        linkedOrderSum += Math.round(Number(o.subtotal) || 0);
      }
      if (linkedOrderSum !== restaurantFolio) return res.status(400).json({ error: "Restaurant total must match linked food orders" });
    }

    const totalAmount = roomPackageTotal + restaurantFolio;
    const advancePaymentCompleted = req.body?.advancePaymentCompleted === true || req.body?.advancePaymentCompleted === "true";
    const doc = await Booking.create({
      customer: req.customer.id,
      bookingType,
      room: room ? room._id : null,
      offer: offer ? offer._id : null,
      checkIn: checkInD,
      checkOut: checkOutD,
      nights,
      fullName,
      contactEmail,
      phone,
      address,
      mealBreakfast: false,
      mealLunch: false,
      mealDinner: false,
      mealIntentRequired: false,
      mealIntentOtherOptions: false,
      mealIntentUnsure: false,
      mealsAddLater: Boolean(req.body?.mealsAddLater),
      specialRequests,
      roomSubtotal,
      mealSubtotal,
      taxRate: TAX_RATE,
      taxAmount,
      totalAmount,
      advanceAmount: ADVANCE_LKR,
      remainingAmount: Math.max(0, totalAmount - ADVANCE_LKR),
      advancePaid: Boolean(advancePaymentCompleted),
      summaryLine,
      status: Boolean(advancePaymentCompleted) ? "confirmed" : "pending",
      restaurantFolioSubtotal: restaurantFolio,
    });

    if (room) await Room.updateOne({ _id: room._id, status: "Available" }, { $set: { status: "Reserved" } });
    const populated = await Booking.findById(doc._id).populate("room", "roomNumber roomType variant basePricePerNight").populate("offer", "title packagePrice").lean();
    res.status(201).json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

function bookingIdFromGuestUpdateRequest(req) {
  const fromParams = req.params?.bookingId ?? req.params?.id;
  if (fromParams != null && String(fromParams).trim()) return String(fromParams).trim();
  return String(req.body?.bookingId ?? "").trim();
}

async function updateGuestBooking(req, res) {
  try {
    const bookingId = bookingIdFromGuestUpdateRequest(req);
    if (!mongoose.isValidObjectId(bookingId)) return res.status(400).json({ error: "Invalid booking" });
    const booking = await Booking.findOne({ _id: bookingId, customer: req.customer.id });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status === "cancelled") return res.status(400).json({ error: "Cancelled bookings cannot be updated" });
    if (booking.cancellationRequestStatus === "pending") return res.status(400).json({ error: "This booking has a pending cancellation request." });

    const rawBody = req.body && typeof req.body === "object" ? req.body : {};
    const hasSpecial = rawBody.specialRequests !== undefined;
    const hasCheckIn = rawBody.checkIn !== undefined;
    const hasCheckOut = rawBody.checkOut !== undefined;
    const hasDates = hasCheckIn || hasCheckOut;
    if (!hasSpecial && !hasDates) return res.status(400).json({ error: "Nothing to update" });
    if (hasDates && (!hasCheckIn || !hasCheckOut)) return res.status(400).json({ error: "Provide both checkIn and checkOut" });

    if (hasDates) {
      if (booking.checkedInAt) return res.status(400).json({ error: "Dates cannot be changed after check-in." });
      const checkInD = parseDateOnly(rawBody.checkIn);
      const checkOutD = parseDateOnly(rawBody.checkOut);
      if (!checkInD || !checkOutD || checkOutD <= checkInD) return res.status(400).json({ error: "Invalid check-in/check-out dates" });
      const nights = nightsBetween(checkInD, checkOutD);
      if (nights > MAX_STAY_NIGHTS) return res.status(400).json({ error: `Maximum stay is ${MAX_STAY_NIGHTS} nights.` });

      let roomSubtotal = 0;
      let summaryLine = "";
      if (booking.bookingType === "room") {
        const room = await Room.findById(booking.room).lean();
        if (!room) return res.status(404).json({ error: "Room not found" });
        const overlap = await Booking.exists({ _id: { $ne: booking._id }, room: booking.room, status: { $ne: "cancelled" }, checkIn: { $lt: checkOutD }, checkOut: { $gt: checkInD } });
        if (overlap) return res.status(400).json({ error: "This room is already reserved for the selected dates." });
        roomSubtotal = Math.round(Number(room.basePricePerNight) || 0) * nights;
        summaryLine = `Room ${room.roomNumber} · ${nights} night(s)`;
      } else {
        const offer = await Offer.findOne({ _id: booking.offer, active: true }).populate("rooms", "basePricePerNight").lean();
        if (!offer) return res.status(404).json({ error: "Offer not found or inactive" });
        const pkg = Number(offer.packagePrice) || 0;
        roomSubtotal = pkg > 0 ? Math.round(pkg * nights) : Math.round((offer.rooms || []).reduce((a, r) => a + (Number(r.basePricePerNight) || 0), 0) * nights);
        summaryLine = `${offer.title} · ${nights} night(s)`;
      }

      const taxAmount = Math.round(roomSubtotal * TAX_RATE);
      const totalAmount = roomSubtotal + taxAmount + Math.round(Number(booking.restaurantFolioSubtotal) || 0);
      booking.checkIn = checkInD;
      booking.checkOut = checkOutD;
      booking.nights = nights;
      booking.roomSubtotal = roomSubtotal;
      booking.mealSubtotal = 0;
      booking.taxAmount = taxAmount;
      booking.totalAmount = totalAmount;
      booking.remainingAmount = Math.max(0, totalAmount - (Math.round(Number(booking.advanceAmount) || ADVANCE_LKR)));
      booking.summaryLine = summaryLine;
    }
    if (hasSpecial) {
      const sr = String(rawBody.specialRequests ?? "").trim();
      if (sr.length > 2000) return res.status(400).json({ error: "Special requests must be at most 2000 characters" });
      booking.specialRequests = sr;
    }
    await booking.save();
    const populated = await Booking.findById(booking._id).populate("room", "roomNumber roomType variant basePricePerNight").populate("offer", "title packagePrice").lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
}

router.post("/booking-update", requireCustomer, updateGuestBooking);
router.patch("/bookings/:bookingId", requireCustomer, updateGuestBooking);
router.put("/bookings/:bookingId", requireCustomer, updateGuestBooking);
router.post("/bookings/:bookingId/update", requireCustomer, updateGuestBooking);

router.post("/bookings/:bookingId/cancel", requireCustomer, async (req, res) => {
  try {
    const bookingId = String(req.params.bookingId ?? "").trim();
    if (!mongoose.isValidObjectId(bookingId)) return res.status(400).json({ error: "Invalid booking" });
    const booking = await Booking.findOne({ _id: bookingId, customer: req.customer.id });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status === "cancelled") return res.status(400).json({ error: "This booking is already cancelled" });
    if (booking.checkedInAt) return res.status(400).json({ error: "Cancellation cannot be requested after check-in." });
    if (booking.cancellationRequestStatus === "pending") return res.status(400).json({ error: "A cancellation request is already waiting for review." });
    const reason = String(req.body?.cancellationReason ?? "").trim();
    if (reason.length < 5 || reason.length > 2000) return res.status(400).json({ error: "Cancellation reason must be 5-2000 characters." });
    booking.cancellationRequestStatus = "pending";
    booking.cancellationRequestedAt = new Date();
    booking.cancellationReason = reason;
    booking.cancellationRejectionNote = "";
    booking.cancellationReviewedAt = null;
    await booking.save();
    const populated = await Booking.findById(booking._id).populate("room", "roomNumber roomType variant basePricePerNight").populate("offer", "title packagePrice").lean();
    res.json(populated);
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
