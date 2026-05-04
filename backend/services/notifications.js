import Notification from "../models/Notification.js";
import Staff from "../models/Staff.js";

export async function notifyCustomer(customerId, title, message, issueReport = null) {
  if (!customerId) return;
  await Notification.create({
    recipientType: "customer",
    customer: customerId,
    title,
    message,
    issueReport: issueReport || null,
  });
}

export async function notifyAdmin(adminUsername, title, message, issueReport = null) {
  await Notification.create({
    recipientType: "admin",
    adminUsername: String(adminUsername || "admin"),
    title,
    message,
    issueReport: issueReport || null,
  });
}

export async function notifyMaintenanceStaff(title, message, issueReport = null) {
  const team = await Staff.find({ active: true }).populate("role").lean();
  const recipients = team.filter((s) => {
    const role = s.role?.name || "";
    return role === "Room Manager" || role === "Receptionist";
  });
  if (recipients.length === 0) return;
  await Notification.insertMany(
    recipients.map((s) => ({
      recipientType: "staff",
      staff: s._id,
      title,
      message,
      issueReport: issueReport || null,
    }))
  );
}

export async function notifyStaff(staffId, title, message, issueReport = null) {
  if (!staffId) return;
  await Notification.create({
    recipientType: "staff",
    staff: staffId,
    title,
    message,
    issueReport: issueReport || null,
  });
}
