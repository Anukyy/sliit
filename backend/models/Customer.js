import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerNumber: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, match: /^\d{10}$/ },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    /** Optional profile details editable by the guest */
    profileFirstName: { type: String, default: "", trim: true, maxlength: 80 },
    profileLastName: { type: String, default: "", trim: true, maxlength: 80 },
    profileMobile: { type: String, default: "", trim: true, maxlength: 30 },
    profileServiceUrl: { type: String, default: "", trim: true, maxlength: 500 },
    profilePhotoUrl: { type: String, default: "", trim: true, maxlength: 500 },
    preferredRoomType: { type: String, default: "", trim: true, maxlength: 80 },
    preferredFood: { type: String, default: "", trim: true, maxlength: 120 },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    /** Soft delete (guest-initiated) */
    deletedAt: { type: Date, default: null },
    deletedReason: { type: String, default: "", trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", customerSchema);
