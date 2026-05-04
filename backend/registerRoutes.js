/**
 * All API route mounts in one place (mobile + admin clients).
 * Prefixes are stable — changing them breaks Expo `mobile-app` callers.
 */
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import staffPortalRoutes from "./routes/staffPortal.js";
import staffAdminRoutes from "./routes/staffAdmin.js";
import shiftRoutes from "./routes/shifts.js";
import reportRoutes from "./routes/reports.js";
import { getPublicRoomAvailability, getPublicRooms } from "./routes/publicRooms.js";
import { getPublicOffers } from "./routes/publicOffers.js";
import roomPortalRoutes from "./routes/roomPortal.js";
import customerAuthRoutes from "./routes/customerAuth.js";
import customerManagerPortalRoutes from "./routes/customerManagerPortal.js";
import customerBookingsRoutes from "./routes/customerBookings.js";
import receptionistBookingsRoutes from "./routes/receptionistBookings.js";
import publicFoodItemsRoutes from "./routes/publicFoodItems.js";
import customerFoodOrdersRoutes from "./routes/customerFoodOrders.js";
import kitchenManagerPortalRoutes from "./routes/kitchenManagerPortal.js";
import publicReviewsRoutes from "./routes/publicReviews.js";
import customerReviewsRoutes from "./routes/customerReviews.js";
import reviewManagerPortalRoutes from "./routes/reviewManagerPortal.js";
import adminIssuesRoutes from "./routes/adminIssues.js";

export function registerRoutes(app) {
  const api = express.Router();

  api.get("/health", (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 });
  });

  api.use("/auth", authRoutes);

  api.use("/customer-auth", customerAuthRoutes);
  api.use("/customer-auth", customerBookingsRoutes);
  api.use("/customer-auth", customerFoodOrdersRoutes);
  api.use("/customer-auth", customerReviewsRoutes);

  api.use("/staff-portal", staffPortalRoutes);
  api.use("/staff-portal", roomPortalRoutes);
  api.use("/staff-portal", customerManagerPortalRoutes);
  api.use("/staff-portal", receptionistBookingsRoutes);
  api.use("/staff-portal", kitchenManagerPortalRoutes);
  api.use("/staff-portal", reviewManagerPortalRoutes);

  api.get("/public/rooms", getPublicRooms);
  api.get("/public/rooms/:roomId/availability", getPublicRoomAvailability);
  api.get("/public/offers", getPublicOffers);
  api.use("/public", publicFoodItemsRoutes);
  api.use("/public", publicReviewsRoutes);

  api.use("/staff", staffAdminRoutes);
  api.use("/admin", adminIssuesRoutes);
  api.use("/shifts", shiftRoutes);
  api.use("/reports", reportRoutes);

  api.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use("/api", api);
}
