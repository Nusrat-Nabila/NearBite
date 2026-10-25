
/* ================= IMAGES ================= */

import logo from "../Image/logo.png";
import banner from "../Image/banner.png";

import cuisineFastFood from "../Image/cuisine-fastfood.png";
import cuisinePizza from "../Image/cuisine-pizza.png";
import cuisineCoffee from "../Image/cuisine-coffee.png";
import cuisineBiryani from "../Image/cuisine-biryani.png";
import cuisineCake from "../Image/cuisine-cake.png";
import cuisineFish from "../Image/cuisine-fish.png";

import dealChillox from "../Image/deal-chillox.png";
import dealKfc from "../Image/deal-kfc.png";
import dealShawarma from "../Image/deal-shawarma.png";
import dealSultans from "../Image/deal-sultans.png";

import groupSweetCrumbs from "../Image/group-sweetcrumbs.png";
import groupCrimson from "../Image/group-crimson.png";
import groupKfc from "../Image/group-kfc.png";
import groupSultans from "../Image/group-sultans.png";
import groupBurgerKing from "../Image/group-burgerking.png";
import groupBuffet from "../Image/group-buffet.png";

import restPizza from "../Image/rest-pizza.png";
import restBurger from "../Image/rest-burger.png";
import restShawarma from "../Image/rest-shawarma.png";
import restBiryani from "../Image/rest-biryani.png";

import facebook from "../Image/facebook.png";
import instagram from "../Image/instagram.png";

/* ================= GENERAL IMAGES ================= */

export const img = {
  logo,
  banner,
  facebook,
  instagram,
};

/* ================= LOCATIONS ================= */

export const locations = [
  "Dhanmondi",
  "Mohammadpur",
  "Uttara",
  "Banani",
  "Gulshan",
  "Mirpur",
];

/* ================= CUISINES ================= */

export const cuisines = [
  {
    name: "Fast Food",
    image: cuisineFastFood,
  },
  {
    name: "Pizza",
    image: cuisinePizza,
  },
  {
    name: "Coffee",
    image: cuisineCoffee,
  },
  {
    name: "Biryani",
    image: cuisineBiryani,
  },
  {
    name: "Desert",
    image: cuisineCake,
  },
  {
    name: "Bangladeshi",
    image: cuisineFish,
  },
];

/* ================= MENU HELPERS ================= */

const commonCategories = [
  { id: "popular", name: "Popular" },
  { id: "deals", name: "Deals" },
  { id: "burgers", name: "Burgers" },
  { id: "pizza", name: "Pizza" },
  { id: "shawarma", name: "Shawarma" },
  { id: "biryani", name: "Biryani" },
  { id: "sides", name: "Sides" },
  { id: "drinks", name: "Drinks" },
];

/* ================= MENU ITEM CREATOR ================= */

const createMenuItem = ({
  id,
  name,
  description,
  image,
  price,
  oldPrice = null,
  rating = 4.5,
  available = true,
  categories = ["popular"],
}) => {
  const discount =
    oldPrice && oldPrice > price
      ? `${Math.round(
          ((oldPrice - price) / oldPrice) * 100
        )}% OFF`
      : null;

  return {
    id,
    name,
    description,
    image,
    price,
    oldPrice,
    discount,
    rating,
    available,
    categories,
  };
};

/* ================= RESTAURANT CREATOR ================= */

const createRestaurant = ({
  id,
  name,
  rating,
  type,
  area,
  dish,
  price,
  old,
  off,
  offer,
  image,
  description,
  address,
  openingTime = "10:00",
  closingTime = "23:00",
  categories = commonCategories,
  menu = [],
  reviews = [],
  ratingCount = 0,

  // New filter fields
  cuisine = [],
  dietaryTags = [],
  mealTypes = [],
  goodFor = [],
}) => ({
  id,
  name,
  rating,
  type,
  area,
  city: "Dhaka",
  dish,
  price,
  old,
  off,
  offer,
  image,

  description:
    description ||
    `Explore delicious food and special offers at ${name}.`,

  address: address || `${area}, Dhaka`,

  openingTime,
  closingTime,

  categories,
  menu,
  reviews,
  ratingCount,

  /* ================= FILTER METADATA ================= */

  cuisine: Array.isArray(cuisine)
    ? cuisine
    : [cuisine],

  dietaryTags: Array.isArray(dietaryTags)
    ? dietaryTags
    : [dietaryTags],

  mealTypes: Array.isArray(mealTypes)
    ? mealTypes
    : [mealTypes],

  goodFor: Array.isArray(goodFor)
    ? goodFor
    : [goodFor],

  /* ================= LOCATION ================= */

  // Owner-provided verified coordinates later.
  latitude: null,
  longitude: null,
});

/* ================= RESTAURANTS ================= */

// Existing four restaurant cards are kept first.

export const restaurants = [
  /* ================= PIZZABURG ================= */

  createRestaurant({
    id: "pizzaburg",
    name: "Pizzaburg",
    rating: "4.5",
    ratingCount: 82,
    type: "Fastfood",
    area: "Dhanmondi",
    dish: "Margherita Pizza",
    price: 320,
    old: 800,
    off: "60%",
    offer: "60% off Margherita Pizza",
    image: restPizza,

    cuisine: ["Italian", "Fast Food", "Pizza"],

    // Dietary status not verified.
    dietaryTags: [],

    mealTypes: [],
    goodFor: [],

    categories: [
      { id: "popular", name: "Popular" },
      { id: "deals", name: "Deals" },
      { id: "pizza", name: "Pizza" },
      { id: "sides", name: "Sides" },
      { id: "drinks", name: "Drinks" },
    ],

    menu: [
      createMenuItem({
        id: "pizzaburg-margherita",
        name: "Margherita Pizza",
        description:
          "Classic pizza with mozzarella, tomato sauce and fresh herbs.",
        image: restPizza,
        price: 320,
        oldPrice: 800,
        rating: 4.5,
        available: true,
        categories: ["popular", "deals", "pizza"],
      }),

      createMenuItem({
        id: "pizzaburg-cheese",
        name: "Cheese Lover Pizza",
        description:
          "Loaded with rich cheese and a freshly baked crust.",
        image: restPizza,
        price: 490,
        oldPrice: 590,
        rating: 4.6,
        available: false,
        categories: ["popular", "pizza"],
      }),

      createMenuItem({
        id: "pizzaburg-garlic",
        name: "Garlic Bread",
        description:
          "Toasted garlic bread with a buttery finish.",
        image: restPizza,
        price: 150,
        rating: 4.3,
        available: true,
        categories: ["sides"],
      }),
    ],
  }),

  /* ================= BURGER HOUSE ================= */

  createRestaurant({
    id: "burger-house",
    name: "Burger House",
    rating: "4.7",
    ratingCount: 100,
    type: "Fast food",
    area: "Mohammadpur",
    dish: "Double Smash Burger",
    price: 380,
    old: 475,
    off: "20%",
    offer: "Save ৳95 on your burger",
    image: restBurger,
    address: "10 Nurjahan Rd, Dhaka 1207",

    cuisine: ["Fast Food"],

    dietaryTags: [],
    mealTypes: [],
    goodFor: [],

    categories: [
      { id: "popular", name: "Popular" },
      { id: "deals", name: "Deals" },
      { id: "burgers", name: "Burgers" },
      { id: "sides", name: "Sides" },
      { id: "drinks", name: "Drinks" },
    ],

    menu: [
      createMenuItem({
        id: "burger-house-double-smash",
        name: "Double Smash Burger",
        description:
          "Two juicy patties, melted cheese, fresh vegetables and signature sauce.",
        image: restBurger,
        price: 380,
        oldPrice: 475,
        rating: 4.8,
        available: true,
        categories: ["popular", "deals", "burgers"],
      }),

      createMenuItem({
        id: "burger-house-chicken",
        name: "Chicken Cheese Burger",
        description:
          "Chicken patty with cheese, lettuce and creamy sauce.",
        image: restBurger,
        price: 320,
        oldPrice: 400,
        rating: 4.5,
        available: false,
        categories: ["popular", "burgers"],
      }),

      createMenuItem({
        id: "burger-house-classic",
        name: "Classic Burger",
        description:
          "A classic burger with fresh lettuce and house-made sauce.",
        image: restBurger,
        price: 280,
        rating: 4.4,
        available: true,
        categories: ["burgers"],
      }),
    ],

    reviews: [
      {
        id: "burger-review-1",
        customerName: "Rahim",
        rating: 5,
        comment: "Loved the burger!",
        date: "2026-10-15",
      },
    ],
  }),

  /* ================= SHAWARMA GHOR ================= */

  createRestaurant({
    id: "shawarma-ghor",
    name: "Shawarma Ghor",
    rating: "4.6",
    ratingCount: 75,
    type: "Middle Eastern",
    area: "Dhanmondi",
    dish: "Chicken Shawarma",
    price: 180,
    old: 240,
    off: "25%",
    offer: "Save ৳60 on your shawarma",
    image: restShawarma,

    cuisine: ["Arabian", "Middle Eastern"],

    dietaryTags: [],
    mealTypes: [],
    goodFor: [],

    categories: [
      { id: "popular", name: "Popular" },
      { id: "deals", name: "Deals" },
      { id: "shawarma", name: "Shawarma" },
      { id: "sides", name: "Sides" },
      { id: "drinks", name: "Drinks" },
    ],

    menu: [
      createMenuItem({
        id: "shawarma-ghor-chicken",
        name: "Chicken Shawarma",
        description:
          "Tender chicken, vegetables and creamy garlic sauce wrapped in flatbread.",
        image: restShawarma,
        price: 180,
        oldPrice: 240,
        rating: 4.6,
        available: true,
        categories: ["popular", "deals", "shawarma"],
      }),

      createMenuItem({
        id: "shawarma-ghor-special",
        name: "Special Shawarma",
        description:
          "A generously filled shawarma with extra chicken and special sauce.",
        image: restShawarma,
        price: 260,
        rating: 4.7,
        available: false,
        categories: ["popular", "shawarma"],
      }),
    ],
  }),

  /* ================= BIRYANI BARI ================= */

  createRestaurant({
    id: "biryani-bari",
    name: "Biryani Bari",
    rating: "4.8",
    ratingCount: 120,
    type: "Bangladeshi",
    area: "Banani",
    dish: "Chicken Biryani",
    price: 360,
    old: 450,
    off: "20%",
    offer: "Save ৳90 on your biryani",
    image: restBiryani,

    cuisine: ["Bengali", "Bangladeshi", "Biryani"],

    dietaryTags: [],
    mealTypes: [],
    goodFor: [],

    categories: [
      { id: "popular", name: "Popular" },
      { id: "deals", name: "Deals" },
      { id: "biryani", name: "Biryani" },
      { id: "sides", name: "Sides" },
      { id: "drinks", name: "Drinks" },
    ],

    menu: [
      createMenuItem({
        id: "biryani-bari-chicken",
        name: "Chicken Biryani",
        description:
          "Aromatic basmati rice cooked with chicken and traditional spices.",
        image: restBiryani,
        price: 360,
        oldPrice: 450,
        rating: 4.8,
        available: true,
        categories: ["popular", "deals", "biryani"],
      }),

      createMenuItem({
        id: "biryani-bari-special",
        name: "Special Biryani",
        description:
          "Richly spiced biryani served with tender meat.",
        image: restBiryani,
        price: 490,
        rating: 4.7,
        available: false,
        categories: ["popular", "biryani"],
      }),
    ],
  }),
];

/* ================= ADDITIONAL RESTAURANTS ================= */

// These support the existing Home deals and group cards.
// They are separate so the original All Restaurants grid
// remains unchanged.

export const additionalRestaurants = [
  /* ================= CHILLOX ================= */

  createRestaurant({
    id: "chillox",
    name: "Chillox",
    rating: "4.6",
    ratingCount: 95,
    type: "Fast Food",
    area: "Dhanmondi",
    dish: "Chicken Burger",
    price: 340,
    old: 400,
    off: "15%",
    offer: "Up to 15% off",
    image: dealChillox,

    cuisine: ["Fast Food"],

    dietaryTags: [],
    mealTypes: [],
    goodFor: [],

    categories: [
      { id: "popular", name: "Popular" },
      { id: "deals", name: "Deals" },
      { id: "burgers", name: "Burgers" },
      { id: "drinks", name: "Drinks" },
    ],

    menu: [
      createMenuItem({
        id: "chillox-deal",
        name: "Chicken Burger",
        description:
          "Juicy chicken burger with a special discount.",
        image: dealChillox,
        price: 340,
        oldPrice: 400,
        available: true,
        categories: ["popular", "deals", "burgers"],
      }),
    ],
  }),

  /* ================= KFC ================= */

  createRestaurant({
    id: "kfc",
    name: "KFC",
    rating: "4.7",
    ratingCount: 110,
    type: "Fast Food",
    area: "Dhanmondi",
    dish: "Chicken Combo",
    price: 420,
    old: 600,
    off: "30%",
    offer: "30% off selected items",
    image: dealKfc,

    cuisine: ["Fast Food"],

    dietaryTags: [],
    mealTypes: [],
    goodFor: [],

    categories: [
      { id: "popular", name: "Popular" },
      { id: "deals", name: "Deals" },
      { id: "sides", name: "Sides" },
      { id: "drinks", name: "Drinks" },
    ],

    menu: [
      createMenuItem({
        id: "kfc-deal",
        name: "Chicken Combo",
        description:
          "A delicious chicken combo at a discounted price.",
        image: dealKfc,
        price: 420,
        oldPrice: 600,
        available: true,
        categories: ["popular", "deals"],
      }),
    ],
  }),

  /* ================= SULTAN'S DINE ================= */

  createRestaurant({
    id: "sultans-dine",
    name: "Sultan's Dine",
    rating: "4.8",
    ratingCount: 130,
    type: "Bangladeshi",
    area: "Dhanmondi",
    dish: "Kacchi Biryani",
    price: 480,
    old: 600,
    off: "20%",
    offer: "Up to 20% off",
    image: dealSultans,

    cuisine: ["Bengali", "Bangladeshi", "Biryani"],

    dietaryTags: [],
    mealTypes: [],
    goodFor: [],

    categories: [
      { id: "popular", name: "Popular" },
      { id: "deals", name: "Deals" },
      { id: "biryani", name: "Biryani" },
      { id: "drinks", name: "Drinks" },
    ],

    menu: [
      createMenuItem({
        id: "sultans-deal",
        name: "Kacchi Biryani",
        description:
          "Traditional kacchi biryani with aromatic spices.",
        image: dealSultans,
        price: 480,
        oldPrice: 600,
        available: true,
        categories: ["popular", "deals", "biryani"],
      }),
    ],
  }),

  /* ================= GROUP RESTAURANTS ================= */

  ...[
    {
      id: "sweet-crumbs",
      name: "Sweet Crumbs",
      area: "Uttara",
      rating: "4.7",
      image: groupSweetCrumbs,
      type: "Bakery",
      cuisine: ["Bakery"],
    },

    {
      id: "crimson-cup",
      name: "Crimson Cup Coffee",
      area: "Dhanmondi",
      rating: "4.6",
      image: groupCrimson,
      type: "Coffee",
      cuisine: ["Coffee"],
    },

    {
      id: "burger-king",
      name: "Burger King",
      area: "Uttara",
      rating: "4.5",
      image: groupBurgerKing,
      type: "Fast Food",
      cuisine: ["Fast Food"],
    },

    {
      id: "buffet-carnival",
      name: "Buffet Carnival",
      area: "Dhanmondi",
      rating: "4.8",
      image: groupBuffet,
      type: "Buffet",
      cuisine: ["Buffet"],
    },
  ].map((item) =>
    createRestaurant({
      ...item,
      dish: "Featured menu",
      price: 0,
      old: null,
      off: null,
      offer: "",

      dietaryTags: [],
      mealTypes: [],
      goodFor: [],

      categories: [
        { id: "popular", name: "Popular" },
        { id: "deals", name: "Deals" },
      ],

      menu: [],
    })
  ),
];

/* ================= ALL RESTAURANTS ================= */

// One lookup for every restaurant.

export const allRestaurants = [
  ...restaurants,
  ...additionalRestaurants,
];

/* ================= RESTAURANT LOOKUP ================= */

export function findRestaurantById(id) {
  if (id == null) return null;

  return (
    allRestaurants.find(
      (restaurant) =>
        String(restaurant.id) === String(id)
    ) || null
  );
}

/* ================= HOME DEALS ================= */

export const deals = [
  {
    id: "home-deal-chillox",
    off: "15%",
    title: "Up to 15% off",
    shop: "Chillox-Dhanmondi",
    restaurantId: "chillox",
    foodId: "chillox-deal",
    image: dealChillox,
  },

  {
    id: "home-deal-kfc",
    off: "30%",
    title: "30% off selected pizzas",
    shop: "KFC-Dhanmondi",
    restaurantId: "kfc",
    foodId: "kfc-deal",
    image: dealKfc,
  },

  {
    id: "home-deal-shawarma",
    off: "10%",
    title: "Buy 1 get 1 offer",
    shop: "Shawerma Ghor-Mohammadpur",
    restaurantId: "shawarma-ghor",
    foodId: "shawarma-ghor-chicken",
    image: dealShawarma,
  },

  {
    id: "home-deal-sultans",
    off: "20%",
    title: "Up to 20% off",
    shop: "Sultan's Dine-Dhanmondi",
    restaurantId: "sultans-dine",
    foodId: "sultans-deal",
    image: dealSultans,
  },
];

/* ================= GROUPS ================= */

export const groups = [
  {
    name: "Sweet Crumbs",
    restaurantId: "sweet-crumbs",
    rating: 4.7,
    area: "Uttara",
    image: groupSweetCrumbs,
  },

  {
    name: "Crimson Cup Coffee",
    restaurantId: "crimson-cup",
    rating: 4.6,
    area: "Dhanmondi",
    image: groupCrimson,
  },

  {
    name: "KFC",
    restaurantId: "kfc",
    rating: 4.7,
    area: "Dhanmondi",
    image: groupKfc,
  },

  {
    name: "Sultan's Dine",
    restaurantId: "sultans-dine",
    rating: 4.8,
    area: "Dhanmondi",
    image: groupSultans,
  },

  {
    name: "Burger King",
    restaurantId: "burger-king",
    rating: 4.5,
    area: "Uttara",
    image: groupBurgerKing,
  },

  {
    name: "Buffet Carnival",
    restaurantId: "buffet-carnival",
    rating: 4.8,
    area: "Dhanmondi",
    image: groupBuffet,
  },
];

/* ================= FILTER GROUPS ================= */

// Category, Meal type and Good for remain here.
//
// Cuisine and Dietary Tags are loaded dynamically
// from Admin Dashboard localStorage by Filters.jsx.
//
// So we do not keep static Cuisine / Dietary groups here.

export const filterGroups = [
  {
    title: "Category",
    items: [
      "All",
      "Pizza",
      "Burgers",
      "Sushi",
      "Chinese",
      "Indian",
      "Thai",
      "Soup",
      "Bangladeshi",
    ],
    radio: true,
  },

  {
    title: "Meal type",
    items: [
      "Breakfast",
      "Lunch",
      "Snacks",
      "Dinner",
    ],
    radio: false,
  },

  {
    title: "Good for",
    items: [
      "Family",
      "Couples",
      "Friends / Large Groups",
      "Solo",
    ],
    radio: false,
  },
];
