import Booking from "../models/Booking.js";

/**
 * Whether "now" falls on a calendar day from scheduled check-in through check-out (inclusive, UTC),
 * matching how bookings store date-only values (noon UTC per parseDateOnly).
 */
export function isInstantWithinStayWindow(now, checkIn, checkOut) {
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  const start = Date.UTC(ci.getUTCFullYear(), ci.getUTCMonth(), ci.getUTCDate());
  const end = Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate(), 23, 59, 59, 999);
  const t = now.getTime();
  return t >= start && t <= end;
}

export function bookingQualifiesForInStayFeatures(booking, now = new Date()) {
  if (!booking || booking.status === "cancelled") return false;
  if (booking.status !== "confirmed") return false;
  if (!booking.checkedInAt) return false;
  if (!isInstantWithinStayWindow(now, booking.checkIn, booking.checkOut)) return false;
  if (booking.checkedOutAt) {
    const out = new Date(booking.checkedOutAt).getTime();
    if (now.getTime() > out) return false;
  }
  return true;
}

export async function getCustomerStayContext(customerId) {
  const now = new Date();
  const list = await Booking.find({
    customer: customerId,
    status: "confirmed",
  })
    .select("_id checkIn checkOut checkedInAt checkedOutAt status")
    .lean();
  const activeBookingIds = list
    .filter((b) => bookingQualifiesForInStayFeatures(b, now))
    .map((b) => String(b._id));
  return { inStay: activeBookingIds.length > 0, activeBookingIds };
}

export async function customerHasInStayBooking(customerId) {
  const ctx = await getCustomerStayContext(customerId);
  return ctx.inStay;
}
