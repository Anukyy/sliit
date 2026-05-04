import mongoose from "mongoose";

export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled"];

const bookingSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    bookingType: { type: String, enum: ["room", "offer"], required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    fullName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    mealBreakfast: { type: Boolean, default: false },
    mealLunch: { type: Boolean, default: false },
    mealDinner: { type: Boolean, default: false },
    /** Optional guest flags (legacy — no longer set from new booking flow) */
    mealIntentRequired: { type: Boolean, default: false },
    mealIntentOtherOptions: { type: Boolean, default: false },
    mealIntentUnsure: { type: Boolean, default: false },
    /** Guest chose to decide on meals later (restaurant / in-stay ordering) */
    mealsAddLater: { type: Boolean, default: false },
    specialRequests: { type: String, default: "", trim: true },
    roomSubtotal: { type: Number, required: true, min: 0 },
    mealSubtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true },
    taxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    /** Compulsory advance (LKR) — fixed at booking time */
    advanceAmount: { type: Number, required: true, default: 5000 },
    remainingAmount: { type: Number, required: true, min: 0 },
    /** Set when the guest flow records the LKR advance (e.g. after payment gateway) */
    advancePaid: { type: Boolean, default: false },
    /** Receptionist: remaining balance collected */
    balancePaid: { type: Boolean, default: false },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending" },
    /** Snapshot for lists */
    summaryLine: { type: String, default: "", trim: true },
    /** Restaurant orders (room folio) added before/during booking — included in totalAmount / remainingAmount */
    restaurantFolioSubtotal: { type: Number, default: 0, min: 0 },
    /** Set when the guest cancels; refund = advance − fee when advance was paid */
    cancelledAt: { type: Date, default: null },
    cancellationFeeLkr: { type: Number, default: null, min: 0 },
    cancellationRefundLkr: { type: Number, default: null, min: 0 },
    /** Guest explanation when cancelling (staff-visible) */
    cancellationReason: { type: String, default: "", trim: true, maxLength: 2000 },
    /** Guest asks to cancel; reception approves (refund) or rejects */
    cancellationRequestStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    cancellationRequestedAt: { type: Date, default: null },
    cancellationReviewedAt: { type: Date, default: null },
    cancellationRejectionNote: { type: String, default: "", trim: true, maxLength: 500 },
    /** Receptionist: actual guest arrival at desk */
    checkedInAt: { type: Date, default: null },
    /** Receptionist: actual guest departure at desk */
    checkedOutAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ createdAt: -1 });

export default mongoose.model("Booking", bookingSchema);
