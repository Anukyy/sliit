import Room from "../models/Room.js";

/** Total guest rooms in the fixed catalog (numbers 1 … FIXED_ROOM_COUNT). */
export const FIXED_ROOM_COUNT = 50;

/** Allowed roomNumber strings; anything else is removed on seed. */
export const ALLOWED_ROOM_NUMBERS = Array.from({ length: FIXED_ROOM_COUNT }, (_, i) => String(i + 1));

function floorForRoom(n) {
  return Math.min(5, Math.ceil(n / 10));
}

function roomTypeForRoom(n) {
  if (n >= 1 && n <= 10) return "Standard Room";
  if (n >= 11 && n <= 20) return "Deluxe Room";
  if (n >= 21 && n <= 30) return "Super Deluxe Room";
  if (n >= 31 && n <= 40) return "Family Suite";
  if (n >= 41 && n <= 50) return "Luxury Suite";
  return "Standard Room";
}

function capacityForRoom(n) {
  if (n >= 1 && n <= 10) return 2;
  if (n >= 11 && n <= 20) return 3;
  if (n >= 21 && n <= 30) return 4;
  if (n >= 31 && n <= 40) return 5;
  if (n >= 41 && n <= 50) return 2;
  return 2;
}

/**
 * Catalog fields for room n (1–FIXED_ROOM_COUNT). Used on insert and to re-sync layout fields each boot.
 */
export function buildRoomSpec(n) {
  const floor = floorForRoom(n);
  const roomType = roomTypeForRoom(n);
  const capacity = capacityForRoom(n);

  if (n >= 1 && n <= 15) {
    const airConditioned = n % 2 === 1;
    return {
      variant: "Standard",
      roomType,
      floor,
      capacity,
      airConditioned,
      description:
        "Basic room for 1–2 guests. Comfortable and practical — available with or without air conditioning.",
      basePricePerNight: airConditioned ? 12500 : 9900,
      amenities: airConditioned ? ["Wi‑Fi", "Air conditioning"] : ["Wi‑Fi"],
    };
  }

  if (n >= 16 && n <= 30) {
    const airConditioned = n <= 27;
    return {
      variant: "King",
      roomType,
      floor,
      capacity,
      airConditioned,
      description: "Larger room with king-size bed — more comfort; mostly air conditioned.",
      basePricePerNight: airConditioned ? 21000 : 17500,
      amenities: airConditioned ? ["Wi‑Fi", "Air conditioning", "King bed"] : ["Wi‑Fi", "King bed"],
    };
  }

  if (n >= 31 && n <= 40) {
    return {
      variant: "Deluxe",
      roomType,
      floor,
      capacity,
      airConditioned: true,
      description: "Better interior with more space — air conditioned; ideal for couples or business guests.",
      basePricePerNight: 28500,
      amenities: ["Wi‑Fi", "Air conditioning", "Workspace", "Premium bath"],
    };
  }

  if (n >= 41 && n <= 45) {
    return {
      variant: "Duplex",
      roomType,
      floor,
      capacity,
      airConditioned: true,
      description: "Two-level room with internal stairs — luxury feel; air conditioned only.",
      basePricePerNight: 45000,
      amenities: ["Wi‑Fi", "Air conditioning", "Two levels", "Living area"],
    };
  }

  if (n >= 46 && n <= 50) {
    return {
      variant: "Suite",
      roomType,
      floor,
      capacity,
      airConditioned: true,
      description: "Very spacious suite for families — air conditioning and premium facilities.",
      basePricePerNight: 62000,
      amenities: ["Wi‑Fi", "Air conditioning", "Family layout", "Premium facilities", "Lounge area"],
    };
  }

  throw new Error(`Invalid room index ${n} (expected 1–${FIXED_ROOM_COUNT})`);
}

/**
 * Remove any room not in 1…FIXED_ROOM_COUNT; upsert all with correct variant layout.
 * Preserves per-room description, pricing, status, photos when the document already exists
 * (only $setOnInsert fills defaults on first create; recurring $set syncs variant/floor/capacity/AC/type).
 */
export async function ensureFixedRooms() {
  await Room.updateMany({}, { $unset: { packages: 1 } });
  await Room.deleteMany({ roomNumber: { $nin: ALLOWED_ROOM_NUMBERS } });

  for (let n = 1; n <= FIXED_ROOM_COUNT; n++) {
    const key = String(n);
    const spec = buildRoomSpec(n);
    await Room.updateOne(
      { roomNumber: key },
      {
        $set: {
          variant: spec.variant,
          roomType: spec.roomType,
          floor: spec.floor,
          capacity: spec.capacity,
          airConditioned: spec.airConditioned,
        },
        $setOnInsert: {
          roomNumber: key,
          description: spec.description,
          basePricePerNight: spec.basePricePerNight,
          amenities: spec.amenities,
          status: "Available",
          photos: [],
        },
      },
      { upsert: true }
    );
  }
}

export function sortRoomsByNumber(rooms) {
  return [...rooms].sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));
}
