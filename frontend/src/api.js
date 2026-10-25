/* ================= API CLIENT ================= */

/*
  Talks to the Django backend (see vite.config.js: /api and /media are proxied to it).

  - login() signs in and keeps the tokens in localStorage.
  - apiFetch() sends "Authorization: Bearer <access token>", and when the backend answers
    401 it gets a new access token through /api/token/refresh/ and tries the request once more.
  - If the refresh fails too, the session is cleared and the handler given to
    setSessionExpiredHandler() runs (App.jsx uses it to log the user out).
*/

const STORAGE_KEY = "nearbite-auth";

/* ================= ROLE NAMES ================= */

// The backend says "restaurant", the frontend says "owner".
const BACKEND_TO_FRONTEND_ROLE = {
  customer: "customer",
  restaurant: "owner",
  admin: "admin",
};

const FRONTEND_TO_BACKEND_ROLE = {
  customer: "customer",
  owner: "restaurant",
  admin: "admin",
};

export const toFrontendRole = (role) =>
  BACKEND_TO_FRONTEND_ROLE[role] ?? role;

export const toBackendRole = (role) =>
  FRONTEND_TO_BACKEND_ROLE[role] ?? role;

/* ================= SESSION STORAGE ================= */

// { access, refresh, user } or null
let session = readSession();

let onSessionExpired = null;

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return parsed?.access && parsed?.refresh && parsed?.user
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function saveSession(next) {
  session = next;

  try {
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error("Could not save the login session:", error);
  }
}

export const getStoredUser = () => session?.user ?? null;

// Keep the signed-in person's details (after a profile edit) so a reload shows the new ones.
export const saveUser = (user) => {
  if (session) saveSession({ ...session, user });
};

export const isSignedIn = () => Boolean(session);

export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

export const logout = () => saveSession(null);

/* ================= BACKEND USER -> FRONTEND USER ================= */

// The shape App.jsx, the Navbar and the dashboards already read.
function toFrontendUser(backendRole, data) {
  const role = toFrontendRole(backendRole);

  if (backendRole === "restaurant") {
    return {
      id: data.id,
      role,
      name: data.name,
      ownerName: data.owner_name || "",
      restaurantName: data.name,
      description: data.description || "",
      coverImage: data.cover_image || "",
      restaurantId: data.id,
      businessId: data.business_reg_id || "",
      email: data.email || "",
      phone: data.phone_no || "",
      city: data.city || "",
      area: data.area || "",
      address: data.location || "",
      photo: data.logo || "",
      profileImage: data.logo || "",
    };
  }

  if (backendRole === "admin") {
    return {
      id: data.id,
      role,
      name: data.admin_name || "Admin",
      email: data.admin_email || "",
      photo: "",
      profileImage: "",
      city: "",
      area: "",
    };
  }

  return {
    id: data.id,
    role,
    name: data.customer_name,
    email: data.customer_email || "",
    phone: data.customer_phone || "",
    city: data.customer_city || "",
    area: data.customer_area || "",
    address: data.customer_address || "",
    photo: data.customer_image || "",
    profileImage: data.customer_image || "",
  };
}

// A profile the backend sent (login, update_customer_profile ...) -> the frontend user.
// backendRole: "customer" | "restaurant" | "admin"
export const mapBackendUser = toFrontendUser;

/* ================= REQUESTS ================= */

async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// One refresh at a time, even when several requests fail together.
let refreshing = null;

function refreshAccessToken() {
  if (!session?.refresh) return Promise.resolve(false);

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch("/api/token/refresh/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: session.refresh }),
        });

        if (!response.ok) return false;

        const data = await readBody(response);
        if (!data?.access) return false;

        saveSession({
          ...session,
          access: data.access,
          // The backend rotates the refresh token: keep the new one.
          refresh: data.refresh || session.refresh,
        });

        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }

  return refreshing;
}

function send(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  let payload;

  if (body instanceof FormData) {
    payload = body; // the browser sets the multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  if (auth && session?.access) {
    headers.Authorization = `Bearer ${session.access}`;
  }

  return fetch(path, { method, headers, body: payload });
}

/*
  apiFetch("/api/list_bookmarks/")
  apiFetch("/api/create_review/3/", { method: "POST", body: { rating: 5 } })

  Returns { ok, status, data } (data is the parsed JSON, or null).
  Only a network failure throws.
*/
export async function apiFetch(path, options = {}) {
  let response = await send(path, options);

  if (response.status === 401 && options.auth !== false && session) {
    if (await refreshAccessToken()) {
      response = await send(path, options);
    } else {
      saveSession(null);
      onSessionExpired?.();
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data: await readBody(response),
  };
}

/* ================= ERROR MESSAGES ================= */

// The backend answers errors as { error: "..." }, { detail: "..." } or, for a form,
// { field: ["message", ...] } / ["message"]. Returns one readable sentence.
export function errorMessage(data, fallback = "Something went wrong. Please try again.") {
  if (!data) return fallback;

  if (typeof data === "string") return data;
  if (typeof data.error === "string") return data.error;
  if (typeof data.detail === "string") return data.detail;

  const first = Array.isArray(data)
    ? data[0]
    : Object.values(data)[0];

  const message = Array.isArray(first) ? first[0] : first;

  return typeof message === "string" ? message : fallback;
}

// Same as apiFetch, but a network failure becomes { ok: false, status: 0, data: null }.
export async function apiCall(path, options) {
  try {
    return await apiFetch(path, options);
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// Every row of a paged list (100 rows a page, at most maxPages pages). null when it could not be loaded.
export async function fetchAllPages(path, maxPages = 20) {
  const rows = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const joint = path.includes("?") ? "&" : "?";

    const { ok, data } = await apiCall(
      `${path}${joint}page=${page}&page_size=100`
    );

    if (!ok) return null;

    rows.push(...data.results);

    if (page >= data.total_pages) break;
  }

  return rows;
}

/* ================= LOGIN ================= */

// role: "customer" | "owner" | "admin" (frontend names).
// Resolves to the frontend user. Throws an Error whose message can be shown to the person.
export async function login(role, email, password) {
  const backendRole = toBackendRole(role);

  let result;
  try {
    result = await apiFetch("/api/login/", {
      method: "POST",
      auth: false,
      body: { role: backendRole, email, password },
    });
  } catch {
    throw new Error(
      "Could not reach the server. Check your connection and try again."
    );
  }

  const { ok, data } = result;

  if (!ok || !data?.success) {
    throw new Error(errorMessage(data, "Login failed. Please try again."));
  }

  const user = toFrontendUser(data.role, data.data);

  saveSession({
    access: data.access_token,
    refresh: data.refresh_token,
    user,
  });

  return user;
}
