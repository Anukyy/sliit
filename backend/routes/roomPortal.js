import { Router } from "express";
import mongoose from "mongoose";
import Room, { ROOM_STATUSES } from "../models/Room.js";
import Offer from "../models/Offer.js";
import { requireRoomManager } from "../middleware/auth.js";
import { sortRoomsByNumber } from "../seed/fixedRooms.js";
import { serverError } from "../lib/respond.js";

const router = Router();

router.post("/rooms/:roomId/photos-by-url", requireRoomManager, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.status === "Reserved" || room.status === "Occupied") {
      return res.status(400).json({ error: "Cannot modify room photos while the room is reserved or occupied" });
    }
    const url = String(req.body?.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "A valid http/https photo URL is required" });
    }
    room.photos.push({
      url,
      originalName: String(req.body?.originalName ?? "external-photo").trim(),
    });
    await room.save();
    const added = room.photos[room.photos.length - 1];
    res.status(201).json(added.toObject());
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/rooms", requireRoomManager, async (_req, res) => {
  try {
    const rooms = sortRoomsByNumber(await Room.find().lean());
    res.json(rooms);
  } catch (err) {
    serverError(res, err);
  }
});

router.get("/rooms/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const room = await Room.findById(id).lean();
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
  } catch (err) {
    serverError(res, err);
  }
});

router.patch("/rooms/:id", requireRoomManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const { description, basePricePerNight, status, amenities } = req.body || {};
    const isBookingLockedRoom = room.status === "Reserved" || room.status === "Occupied";
    if (isBookingLockedRoom && (description !== undefined || basePricePerNight !== undefined)) {
      return res.status(400).json({ error: "Cannot update description or room price while the room is reserved or occupied" });
    }
    if (isBookingLockedRoom && status !== undefined) {
      return res.status(400).json({ error: "Cannot change room status while the room is reserved or occupied" });
    }
    if (description !== undefined) {
      room.description = String(description).trim();
    }
    if (basePricePerNight !== undefined) {
      room.basePricePerNight = Math.max(0, Number(basePricePerNight) || 0);
    }
    if (status !== undefined && ROOM_STATUSES.includes(status)) {
      room.status = status;
    }
    if (amenities !== undefined && Array.isArray(amenities)) {
      room.amenities = amenities.map((a) => String(a).trim()).filter(Boolean);
    }
    await room.save();
    res.json(room.toObject());
  } catch (err) {
    serverError(res, err);
  }
});

function normalizeRoomIds(body) {
  const raw = body?.roomIds ?? body?.rooms;
  if (!Array.isArray(raw)) return [];
  const ids = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))];
  return ids.filter((id) => mongoose.isValidObjectId(id));
}

async function assertRoomsExist(roomIds) {
  if (roomIds.length < 2) {
    return { ok: false, error: "Select at least two rooms for this offer" };
  }
  const count = await Room.countDocuments({ _id: { $in: roomIds } });
  if (count !== roomIds.length) {
    return { ok: false, error: "One or more room ids are invalid" };
  }
  return { ok: true };
}

router.get("/offers", requireRoomManager, async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
    const list = await Offer.find()
      .populate("rooms", "roomNumber variant roomType basePricePerNight status")
      .sort({ updatedAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/offers", requireRoomManager, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
    const title = String(req.body?.title ?? "").trim();
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    const roomIds = normalizeRoomIds(req.body);
    const check = await assertRoomsExist(roomIds);
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }
    const description = String(req.body?.description ?? "").trim();
    const packagePrice = Math.max(0, Number(req.body?.packagePrice) || 0);
    const active = req.body?.active !== false;
    const doc = await Offer.create({
      title,
      description,
      rooms: roomIds,
      packagePrice,
      active,
    });
    const populated = await Offer.findById(doc._id)
      .populate("rooms", "roomNumber variant roomType basePricePerNight status")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    serverError(res, err);
  }
});

router.patch("/offers/:id", requireRoomManager, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    const { title, description, packagePrice, active } = req.body || {};
    if (title !== undefined) {
      const t = String(title).trim();
      if (!t) {
        return res.status(400).json({ error: "title cannot be empty" });
      }
      offer.title = t;
    }
    if (description !== undefined) {
      offer.description = String(description).trim();
    }
    if (packagePrice !== undefined) {
      offer.packagePrice = Math.max(0, Number(packagePrice) || 0);
    }
    if (active !== undefined) {
      offer.active = Boolean(active);
    }
    const roomIds = normalizeRoomIds(req.body);
    if (roomIds.length > 0) {
      const check = await assertRoomsExist(roomIds);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      offer.rooms = roomIds;
    }
    await offer.save();
    const populated = await Offer.findById(offer._id)
      .populate("rooms", "roomNumber variant roomType basePricePerNight status")
      .lean();
    res.json(populated);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    serverError(res, err);
  }
});

router.delete("/offers/:id", requireRoomManager, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected. Start MongoDB and try again." });
    }
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const deleted = await Offer.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;
