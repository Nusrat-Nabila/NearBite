import { apiCall, errorMessage } from "./api";

/*
  Two ways to learn where the customer is. Both resolve to
    { latitude, longitude, label, short }
  and throw an Error whose message can be shown to the person.

    locateByGps()          asks the browser (the person has to allow it)
    locateByPlace(text)    "Dhanmondi, Dhaka" -> a position, looked up by the backend on OpenStreetMap
*/

export function locateByGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          "Your browser cannot share your location. Type a place instead."
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "Your current location",
          short: "Current location",
        }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location access was blocked. Allow it in your browser, or type a place instead."
              : "Could not find your location. Type a place instead."
          )
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export async function locateByPlace(text) {
  const place = String(text || "").trim();

  if (!place) throw new Error("Type a place first, e.g. Dhanmondi, Dhaka.");

  const { ok, data } = await apiCall(
    `/api/find_place/?q=${encodeURIComponent(place)}`,
    { auth: false }
  );

  if (!ok) {
    throw new Error(
      errorMessage(data, "Could not find that place. Please try again.")
    );
  }

  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    label: data.display_name || place,
    short: place.split(",")[0].trim() || place,
  };
}

// "2.4 km" (under 1 km: "450 m")
export function formatDistance(km) {
  if (km == null || !Number.isFinite(Number(km))) return "";

  const value = Number(km);

  return value < 1
    ? `${Math.round(value * 1000)} m`
    : `${value.toFixed(1)} km`;
}
