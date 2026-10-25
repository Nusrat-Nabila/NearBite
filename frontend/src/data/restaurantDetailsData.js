
import burgerImage from "../Image/rest-burger.png";
import dealImage from "../Image/deal-chillox.png";

// Demo data for Restaurant Details & Menu.
// Later, the backend and restaurant owner dashboard
// can provide this information.

export const restaurantDetailsData = {
  id: "burger-house",

  name: "Burger House",
  description:
    "To make it easy for everyone to find great food and amazing dining experiences near them.",

  type: "Fast Food",
  area: "Mohammadpur",
  city: "Dhaka",
  address: "10 Nurjahan Rd, Dhaka 1207",

  image: burgerImage,

  // Restaurant owner will control these values later.
  openingTime: "10:00",
  closingTime: "23:00",

  rating: 4.7,
  ratingCount: 100,

  // Coordinates will be used for customer distance.
  // Add verified coordinates when available.
  latitude: null,
  longitude: null,

  categories: [
    {
      id: "popular",
      name: "Popular",
    },
    {
      id: "deals",
      name: "Deals",
    },
    {
      id: "burgers",
      name: "Burgers",
    },
    {
      id: "wings",
      name: "Wings",
    },
    {
      id: "drinks",
      name: "Drinks",
    },
  ],

  menu: [
    {
      id: "burger-1",
      name: "Chicken Cheese Burger",
      description:
        "Chicken patty, cheese slice, burger buns, mayonnaise, tomato ketchup, lettuce, tomato and onion.",
      image: burgerImage,
      price: 320,
      oldPrice: 400,
      discount: "20% OFF",
      rating: 4.5,
      available: true,
      categories: ["popular", "burgers"],
    },
    {
      id: "burger-2",
      name: "Classic Chicken Burger",
      description:
        "Juicy chicken patty with fresh lettuce, tomato and signature sauce.",
      image: burgerImage,
      price: 280,
      oldPrice: 350,
      discount: "20% OFF",
      rating: 4.4,
      available: false,
      categories: ["popular", "burgers"],
    },
    {
      id: "burger-3",
      name: "Double Cheese Burger",
      description:
        "Double chicken patties with melted cheese and special burger sauce.",
      image: burgerImage,
      price: 450,
      oldPrice: 500,
      discount: "10% OFF",
      rating: 4.8,
      available: true,
      categories: ["burgers"],
    },
    {
      id: "deal-1",
      name: "Special Burger Combo",
      description:
        "Delicious chicken burger combo with a special limited-time discount.",
      image: dealImage,
      price: 399,
      oldPrice: 499,
      discount: "20% OFF",
      rating: 4.6,
      available: false,
      categories: ["deals"],
    },
    {
      id: "wings-1",
      name: "Spicy Chicken Wings",
      description:
        "Crispy chicken wings coated in a spicy signature sauce.",
      image: dealImage,
      price: 290,
      oldPrice: null,
      discount: null,
      rating: 4.5,
      available: true,
      categories: ["wings"],
    },
    {
      id: "drink-1",
      name: "Refreshing Lemonade",
      description:
        "Fresh lemon drink served chilled.",
      image: dealImage,
      price: 120,
      oldPrice: null,
      discount: null,
      rating: 4.3,
      available: true,
      categories: ["drinks"],
    },
  ],

  reviews: [
    {
      id: "review-1",
      customerName: "Rahim",
      rating: 5,
      comment:
        "The burger was delicious and the service was excellent!",
      date: "2026-10-15",
    },
    {
      id: "review-2",
      customerName: "Nusrat",
      rating: 4,
      comment:
        "Really enjoyed the food. Would definitely visit again.",
      date: "2026-10-18",
    },
  ],
};

// Check whether a restaurant is open at the current
// local time. Supports schedules that cross midnight.
export function isRestaurantOpen(
  openingTime,
  closingTime,
  now = new Date()
) {
  if (!openingTime || !closingTime) return false;

  const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const opening = toMinutes(openingTime);
  const closing = toMinutes(closingTime);

  if (
    !Number.isFinite(opening) ||
    !Number.isFinite(closing)
  ) {
    return false;
  }

  const current =
    now.getHours() * 60 + now.getMinutes();

  if (opening === closing) return false;

  if (opening < closing) {
    return current >= opening && current < closing;
  }

  return current >= opening || current < closing;
}

// A category stays active when at least one
// food item in that category is available.
export function isCategoryAvailable(
  categoryId,
  menu = []
) {
  return menu.some(
    (food) =>
      food.categories?.includes(categoryId) &&
      food.available === true
  );
}

// Get all food items for a selected category.
export function getFoodsByCategory(
  categoryId,
  menu = []
) {
  return menu.filter((food) =>
    food.categories?.includes(categoryId)
  );
}

// Calculate distance in kilometers using
// coordinates when both locations are known.
export function calculateDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const coordinates = [lat1, lon1, lat2, lon2];

  if (
    coordinates.some(
      (value) =>
        value == null ||
        !Number.isFinite(Number(value))
    )
  ) {
    return null;
  }

  const toRadians = (degrees) =>
    (Number(degrees) * Math.PI) / 180;

  const earthRadiusKm = 6371;

  const latitudeDifference = toRadians(lat2 - lat1);
  const longitudeDifference = toRadians(lon2 - lon1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}
