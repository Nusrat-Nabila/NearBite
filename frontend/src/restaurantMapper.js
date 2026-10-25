import placeholderImage from "./Image/logo.png";

/* ================= BACKEND RESTAURANT -> FRONTEND CARD ================= */

/*
  A restaurant from the backend (search_restaurant, list_restaurant ...) in the shape the
  cards and the details page already read: name, rating, type, area, dish, price, image ...
  The untouched backend object is kept as `backend`.
*/
export function toRestaurantCard(item) {
  const cuisines = Array.isArray(item.cuisines)
    ? item.cuisines.map((cuisine) => cuisine.name)
    : [];

  const price =
    item.starting_price ?? item.min_price ?? null;

  return {
    id: item.id,
    name: item.name,

    rating: item.rating ?? "New",
    ratingCount: item.rating_count ?? 0,

    type: cuisines.slice(0, 2).join(", ") || "Restaurant",
    cuisine: cuisines,
    dietaryTags: (item.dietary_tags || []).map((tag) => tag.name),
    mealTypes: item.meal_types || [],
    goodFor: item.dining_occasions || [],

    area: item.area || item.city || "",
    city: item.city || "",
    address: item.location || "",
    description: item.description || "",

    dish: item.matched_dishes?.[0] || "",
    price,
    old: null,
    off: null,
    offer: "",

    image: item.cover_image || item.logo || placeholderImage,

    latitude: item.latitude != null ? Number(item.latitude) : null,
    longitude: item.longitude != null ? Number(item.longitude) : null,

    // How far it is from the customer (only when a position was sent with the search).
    distanceKm: item.distance_km ?? null,

    isOpenNow: item.is_open_now ?? null,
    isOpen: item.is_open_now ?? undefined,
    openStatus: item.opening_status || "hours_not_set",

    backend: item,
  };
}

/* ================= BACKEND DEAL -> FRONTEND DEAL CARD ================= */

// A deal from GET /api/list_daily_deals/ in the shape the deal cards read.
// restaurant is a small restaurant object, enough to open the restaurant's page.
export function toDealCard(deal) {
  const restaurant = {
    id: deal.restaurant.id,
    name: deal.restaurant.name,
    area: deal.restaurant.area || "",
    city: deal.restaurant.city || "",
    image: deal.image || placeholderImage,
  };

  return {
    id: deal.id,
    title: deal.deal_title,
    // The badge on the card: "30% OFF" for a percentage deal, else the kind of deal ("Free Item").
    badge:
      deal.discount_percentage != null
        ? `${deal.discount_percentage}% OFF`
        : deal.offer_type_label,
    shop: [restaurant.name, restaurant.area]
      .filter(Boolean)
      .join("-"),
    description: deal.description || "",
    image: deal.image || placeholderImage,
    restaurant,
    restaurantId: restaurant.id,
    foodId: deal.items?.[0]?.id ?? null,
  };
}
