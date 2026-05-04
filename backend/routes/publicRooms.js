import Room from "../models/Room.js";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { sortRoomsByNumber } from "../seed/fixedRooms.js";
import { serverError } from "../lib/respond.js";

/** Public catalog — full inventory (guest-facing browse). Booking still requires `Available` + availability checks. */
export async function getPublicRooms(_req, res) {
  try {
    const rooms = sortRoomsByNumber(await Room.find({}).lean());
    res.json(rooms);
  } catch (err) {
    serverError(res, err);
  }
}

function parseDateOnly(s) {
  const str = String(s ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getPublicRoomAvailability(req, res) {
  try {
    const roomId = String(req.params?.roomId ?? "").trim();
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }

    const checkInD = parseDateOnly(req.query?.checkIn);
    const checkOutD = parseDateOnly(req.query?.checkOut);
    if (!checkInD || !checkOutD || checkOutD <= checkInD) {
      return res.status(400).json({ error: "Valid checkIn/checkOut dates are required" });
    }

    const room = await Room.findById(roomId).lean();
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.status !== "Available") {
      return res.json({
        available: false,
        reason: `Room ${room.roomNumber} is currently ${room.status}.`,
      });
    }

    const overlap = await Booking.exists({
      room: room._id,
      status: { $ne: "cancelled" },
      checkIn: { $lt: checkOutD },
      checkOut: { $gt: checkInD },
    });
    if (overlap) {
      return res.json({
        available: false,
        reason: "This room is already reserved for the selected dates.",
      });
    }

    return res.json({ available: true, reason: "" });
  } catch (err) {
    serverError(res, err);
  }
}
