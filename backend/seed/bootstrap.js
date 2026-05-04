import bcrypt from "bcryptjs";
import AdminAccount from "../models/AdminAccount.js";
import Role from "../models/Role.js";
import Staff from "../models/Staff.js";
import FoodItem from "../models/FoodItem.js";
import { ensureFixedRooms, FIXED_ROOM_COUNT } from "./fixedRooms.js";

async function ensureSampleFoodItems() {
  const menuCount = await FoodItem.countDocuments();
  if (menuCount === 0) {
    await FoodItem.insertMany([
      {
        name: "Velour breakfast bowl",
        description: "Seasonal fruit, yogurt, honey, house granola",
        price: 1850,
        category: "breakfast",
      },
      {
        name: "Grilled sea bass",
        description: "Herb oil, charred lemon, fennel salad",
        price: 4200,
        category: "main",
      },
      {
        name: "Wild mushroom risotto",
        description: "Parmesan, truffle oil, chives",
        price: 3600,
        category: "main",
      },
      {
        name: "Dark chocolate soufflé",
        description: "Vanilla anglaise",
        price: 1950,
        category: "dessert",
      },
    ]);
    console.log("Sample restaurant menu items created (kitchen manager can edit).");
  }
}

/**
 * Canonical manager roles (must match `backend/middleware/auth.js` and mobile routing).
 * Ensured on every bootstrap so DB always has these Role documents.
 */
const CORE_MANAGER_ROLES = [
  { name: "Room Manager", description: "Rooms, housekeeping coordination" },
  { name: "Kitchen Manager", description: "Restaurant & kitchen operations" },
  { name: "Review Manager", description: "Guest feedback & reviews" },
  { name: "Customer Manager", description: "Guest relations & loyalty" },
  { name: "Receptionist", description: "Front desk & guest services" },
];

const PORTAL_TEAM = [
  {
    username: "room_manager",
    password: "room_manager123",
    name: "Room Manager",
    roleName: "Room Manager",
    description: "Rooms, housekeeping coordination",
  },
  {
    username: "kitchen_manager",
    password: "kitchen_manager123",
    name: "Kitchen Manager",
    roleName: "Kitchen Manager",
    description: "Restaurant & kitchen operations",
  },
  {
    username: "review_manager",
    password: "review_manager123",
    name: "Review Manager",
    roleName: "Review Manager",
    description: "Guest feedback & reviews",
  },
  {
    username: "receptionist",
    password: "receptionist123",
    name: "Receptionist",
    roleName: "Receptionist",
    description: "Front desk & guest services",
  },
  {
    username: "customer_manager",
    password: "customer_manager123",
    name: "Customer Manager",
    roleName: "Customer Manager",
    description: "Guest relations & loyalty",
  },
];

async function ensureCoreManagerRoles() {
  for (const r of CORE_MANAGER_ROLES) {
    await Role.findOneAndUpdate(
      { name: r.name },
      { $set: { name: r.name, description: r.description } },
      { upsert: true }
    );
  }
  console.log("Core roles ensured: Room, Kitchen, Review, Customer Manager, Receptionist.");
}

export async function bootstrapData() {
  const admins = await AdminAccount.countDocuments();
  if (admins === 0) {
    await AdminAccount.create({
      username: "admin",
      passwordHash: await bcrypt.hash("admin123", 10),
    });
    console.log("Admin login: admin / admin123");
  }

  await ensureCoreManagerRoles();

  const roleByName = new Map();
  for (const t of PORTAL_TEAM) {
    let role = await Role.findOne({ name: t.roleName });
    if (!role) {
      role = await Role.create({ name: t.roleName, description: t.description });
    }
    roleByName.set(t.roleName, role);
  }

  for (const t of PORTAL_TEAM) {
    const role = roleByName.get(t.roleName);
    if (!role) continue;
    const passwordHash = await bcrypt.hash(t.password, 10);
    const existed = await Staff.exists({ username: t.username });
    await Staff.findOneAndUpdate(
      { username: t.username },
      {
        $set: {
          name: t.name,
          username: t.username,
          passwordHash,
          role: role._id,
          active: true,
        },
      },
      { upsert: true }
    );
    if (!existed) {
      console.log(`Staff portal (new): ${t.username} / ${t.password}`);
    } else {
      console.log(`Staff portal (synced): ${t.username}`);
    }
  }

  await ensureFixedRooms();
  console.log(`Fixed inventory: rooms 1–${FIXED_ROOM_COUNT} (5 variants) ensured.`);

  await ensureSampleFoodItems();
}
