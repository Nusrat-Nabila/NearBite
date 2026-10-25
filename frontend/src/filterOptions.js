import { apiCall } from "./api";

/* ================= FILTER OPTIONS ================= */

/*
  What the filter panel can offer, from GET /api/list_filter_options/:
  { cuisines, dietary_tags, meal_types, dining_occasions, sort_options }.
  Loaded once and shared by Filters.jsx and Explore.jsx.
  Resolves to null when the backend cannot be reached (the next call tries again).
*/

let cached = null;

export function loadFilterOptions() {
  if (!cached) {
    cached = apiCall("/api/list_filter_options/", {
      auth: false,
    }).then(({ ok, data }) => {
      if (!ok || !data) {
        cached = null;
        return null;
      }

      return data;
    });
  }

  return cached;
}

// Forget the saved answer (after the admin changes the tags).
export const reloadFilterOptions = () => {
  cached = null;
  return loadFilterOptions();
};

/* ================= NAME -> VALUE ================= */

const same = (a, b) =>
  String(a ?? "").trim().toLowerCase() ===
  String(b ?? "").trim().toLowerCase();

// Names the person picked ("Fast Food") -> the slugs the backend wants ("fast-food").
// list: [{ name, slug }]
export const toSlugs = (list = [], names = []) =>
  names
    .map((name) => list.find((item) => same(item.name, name))?.slug)
    .filter(Boolean);

// Labels ("Friends / Large Groups") -> values ("friends").
// list: [{ value, label }]
export const toValues = (list = [], labels = []) =>
  labels
    .map((label) => list.find((item) => same(item.label, label))?.value)
    .filter(Boolean);
