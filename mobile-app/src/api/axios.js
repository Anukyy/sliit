import axios from "axios";

/**
 * Production-safe API config
 * Always use Railway backend in production
 */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://sliit-production.up.railway.app/api"; 

if (__DEV__) {
  console.log("[API BASE URL]", BASE_URL);
}

const instance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/* -------------------------
   AUTH HANDLING (UNCHANGED)
-------------------------- */

const roleTokens = {
  admin: null,
  staff: null,
  customer: null,
};

let activeScope = null;

function resolveArgs(arg1, arg2) {
  if (arg2 === undefined) return { scope: "default", token: arg1 };
  return { scope: String(arg1 || "default").toLowerCase(), token: arg2 };
}

function applyAuth() {
  if (!activeScope || !roleTokens[activeScope]) {
    delete instance.defaults.headers.common["Authorization"];
    return;
  }

  instance.defaults.headers.common[
    "Authorization"
  ] = `Bearer ${roleTokens[activeScope]}`;
}

export const setAuthToken = (arg1, arg2) => {
  const { scope, token } = resolveArgs(arg1, arg2);

  if (scope !== "default") {
    roleTokens[scope] = token || null;
    activeScope = scope;
    applyAuth();
    return;
  }

  if (token) {
    instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete instance.defaults.headers.common["Authorization"];
  }
};

export const clearAuthToken = (scope = "default") => {
  const normalized = String(scope).toLowerCase();

  if (normalized !== "default") {
    roleTokens[normalized] = null;

    if (activeScope === normalized) {
      const fallback = ["staff", "customer", "admin"].find(
        (s) => roleTokens[s]
      );
      activeScope = fallback || null;
      applyAuth();
    }
    return;
  }

  delete instance.defaults.headers.common["Authorization"];
};

export default instance;