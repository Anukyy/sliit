import Offer from "../models/Offer.js";
import { serverError } from "../lib/respond.js";

const roomSummary =
  "roomNumber variant roomType basePricePerNight status";

/** Public multi-room offers for the Reservations “Offers” dialog. */
export async function getPublicOffers(_req, res) {
  try {
    const list = await Offer.find({})
      .populate("rooms", roomSummary)
      .sort({ updatedAt: -1 })
      .lean();

    const shaped = list.map((o) => ({
      _id: o._id,
      title: o.title,
      description: o.description,
      packagePrice: o.packagePrice,
      active: o.active !== false,
      photos: (o.photos || []).map((p) => ({ _id: p._id, url: p.url })),
      rooms: (o.rooms || []).filter(Boolean),
    }));

    res.json(shaped);
  } catch (err) {
    serverError(res, err);
  }
}
