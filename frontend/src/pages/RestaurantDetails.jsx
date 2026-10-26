
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Filters from "../components/Filters";

import { apiCall } from "../api";
import { useSearch } from "../searchContext";
import { formatDistance } from "../nearMe";
import placeholderImage from "../Image/logo.png";

import {
  isCategoryAvailable,
  getFoodsByCategory,
  calculateDistanceKm,
} from "../data/restaurantDetailsData";

import "./RestaurantDetails.css";

/* ================= CONSTANTS ================= */

const ITEMS_PER_PAGE = 12;

// Reviews come 10 to a page; the reviews window shows up to this many pages.
const MAX_REVIEW_PAGES = 5;

const DEALS_CATEGORY_ID = "deals";
const OTHER_CATEGORY_ID = "other";

/* ================= HELPERS ================= */

const clampRating = (value) => {
  const number = Number(value) || 0;

  return Math.max(
    0,
    Math.min(5, Math.round(number * 2) / 2)
  );
};

const getRestaurantKey = (restaurant) => {
  if (!restaurant) return "";

  return String(
    restaurant.id ??
      `${restaurant.name}-${restaurant.area ?? ""}-${restaurant.type ?? ""}`
  );
};

const getFoodCategoryIds = (food) => {
  if (!food) return [];

  const rawCategories =
    food.categories ?? food.category ?? [];

  const categoryList = Array.isArray(rawCategories)
    ? rawCategories
    : [rawCategories];

  return categoryList
    .map((category) => {
      if (category && typeof category === "object") {
        return category.id ?? category.name ?? "";
      }

      return category;
    })
    .filter(Boolean)
    .map(String);
};

const getReviewDate = (review) => {
  return review?.date || review?.createdAt || "";
};

// The backend's menu (categories with dishes) -> the menu and category tabs this page draws.
// "Deals" is every dish that is on an active offer today.
function buildMenu(menuData) {
  const foods = new Map();
  const categories = [];

  const add = (dish, categoryId) => {
    const existing = foods.get(dish.id);

    if (existing) {
      existing.categories.push(categoryId);
      return;
    }

    foods.set(dish.id, {
      id: dish.id,
      name: dish.name,
      description: dish.description || "",
      image: dish.image || placeholderImage,
      price: dish.final_price ?? dish.price,
      oldPrice: dish.original_price ?? null,
      discount:
        dish.discount_percent != null
          ? `${dish.discount_percent}% OFF`
          : null,
      rating: dish.rating ?? 0,
      available: dish.is_available,
      categories: [categoryId],
    });
  };

  (menuData?.categories || []).forEach((category) => {
    categories.push({
      id: String(category.id),
      name: category.name,
    });

    category.items.forEach((dish) =>
      add(dish, String(category.id))
    );
  });

  if ((menuData?.uncategorized || []).length > 0) {
    categories.push({
      id: OTHER_CATEGORY_ID,
      name: "Other",
    });

    menuData.uncategorized.forEach((dish) =>
      add(dish, OTHER_CATEGORY_ID)
    );
  }

  const allDishes = [
    ...(menuData?.categories || []).flatMap(
      (category) => category.items
    ),
    ...(menuData?.uncategorized || []),
  ];

  const dealDishes = allDishes.filter((dish) => dish.deal);

  if (dealDishes.length > 0) {
    categories.unshift({
      id: DEALS_CATEGORY_ID,
      name: "Deals",
    });

    dealDishes.forEach((dish) =>
      foods.get(dish.id)?.categories.push(DEALS_CATEGORY_ID)
    );
  }

  return { menu: Array.from(foods.values()), categories };
}

/* ================= HALF-STAR RATING ================= */

function RatingStars({
  rating = 0,
  interactive = false,
  onChange,
  onClear,
}) {
  const [hoverRating, setHoverRating] = useState(null);

  const selectedRating = clampRating(rating);

  const displayRating =
    interactive && hoverRating !== null
      ? hoverRating
      : selectedRating;

  const selectRating = (value) => {
    onChange?.(clampRating(value));
  };

  return (
    <div
      className={`restaurant-half-star-rating ${
        interactive ? "interactive" : "readonly"
      }`}
      onMouseLeave={() => setHoverRating(null)}
      aria-label={`${selectedRating.toFixed(1)} out of 5 stars`}
    >
      <div className="restaurant-half-star-list">
        {[1, 2, 3, 4, 5].map((star) => {
          const halfValue = star - 0.5;
          const fullValue = star;

          const fillPercentage =
            Math.max(
              0,
              Math.min(1, displayRating - (star - 1))
            ) * 100;

          return (
            <span
              key={star}
              className="restaurant-half-star"
            >
              <span
                className="restaurant-half-star-base"
                aria-hidden="true"
              >
                ★
              </span>

              <span
                className="restaurant-half-star-fill"
                style={{
                  width: `${fillPercentage}%`,
                }}
                aria-hidden="true"
              >
                ★
              </span>

              {interactive && (
                <span className="restaurant-half-star-actions">
                  <button
                    type="button"
                    className="restaurant-half-star-hit left"
                    aria-label={`Rate ${halfValue.toFixed(1)} out of 5`}
                    onMouseEnter={() =>
                      setHoverRating(halfValue)
                    }
                    onFocus={() =>
                      setHoverRating(halfValue)
                    }
                    onBlur={() =>
                      setHoverRating(null)
                    }
                    onClick={() =>
                      selectRating(halfValue)
                    }
                  />

                  <button
                    type="button"
                    className="restaurant-half-star-hit right"
                    aria-label={`Rate ${fullValue.toFixed(1)} out of 5`}
                    onMouseEnter={() =>
                      setHoverRating(fullValue)
                    }
                    onFocus={() =>
                      setHoverRating(fullValue)
                    }
                    onBlur={() =>
                      setHoverRating(null)
                    }
                    onClick={() =>
                      selectRating(fullValue)
                    }
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>

      {interactive && (
        <div className="restaurant-rating-value-row">
          <span className="restaurant-rating-value">
            {displayRating.toFixed(1)} / 5.0
          </span>

          <button
            type="button"
            className="restaurant-rating-clear"
            onClick={() => {
              setHoverRating(null);
              onClear?.();
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}


/* ================= MAIN COMPONENT ================= */

export default function RestaurantDetails({
  restaurant: restaurantProp = null,
  selectedFoodId = null,
  initialCategory = null,

  user = null,
  isLoggedIn = false,

  favorites = [],
  onToggleFavorite,

  // Sends a review to the backend (App.jsx). Resolves to false when it was not saved.
  onSubmitReview,

  onLoginClick,
  onHomeClick,
  onExploreClick,
  onCuisineClick,
  onDealsClick,
  onAboutClick,
  onProfileClick,
  onFavoritesClick,
  onReviewsClick,
  onLogout,
  onLogoutClick,
}) {
  /* ================= LOAD FROM THE BACKEND ================= */

  const restaurantId = restaurantProp?.id;

  // Changing this loads everything again (after a review was saved).
  const [reloadCount, setReloadCount] = useState(0);

  // { id, details, menuData, reviews, ratingCounts, error } of the restaurant that was loaded last.
  const [loaded, setLoaded] = useState({ id: null });

  useEffect(() => {
    if (!/^\d+$/.test(String(restaurantId))) return undefined;

    let active = true;

    const load = async () => {
      const [detailsResult, menuResult, firstReviews] =
        await Promise.all([
          apiCall(
            `/api/view_restaurant_details/${restaurantId}/`
          ),
          apiCall(`/api/browse_menu/${restaurantId}/`),
          apiCall(`/api/list_reviews/${restaurantId}/?page=1`),
        ]);

      if (!active) return;

      if (!detailsResult.ok) {
        setLoaded({
          id: restaurantId,
          error:
            detailsResult.status === 404
              ? "This restaurant could not be found."
              : "Could not load this restaurant. Please try again.",
        });
        return;
      }

      let reviews = firstReviews.ok
        ? [...firstReviews.data.results]
        : [];

      const pageCount = firstReviews.ok
        ? Math.min(
            firstReviews.data.total_pages,
            MAX_REVIEW_PAGES
          )
        : 1;

      for (let page = 2; page <= pageCount; page += 1) {
        const next = await apiCall(
          `/api/list_reviews/${restaurantId}/?page=${page}`
        );

        if (!next.ok) break;

        reviews = [...reviews, ...next.data.results];
      }

      if (!active) return;

      setLoaded({
        id: restaurantId,
        details: detailsResult.data,
        menuData: menuResult.ok ? menuResult.data : null,
        reviews,
        ratingCounts: firstReviews.ok
          ? firstReviews.data.rating_counts
          : {},
      });
    };

    load();

    return () => {
      active = false;
    };
  }, [restaurantId, reloadCount]);

  // Restaurants from the backend have a number for an id.
  const hasBackendId = /^\d+$/.test(String(restaurantId));

  const isLoading =
    hasBackendId && loaded.id !== restaurantId;

  const loadError = hasBackendId
    ? loaded.error
    : "This restaurant is not available.";

  /* ================= RESTAURANT DATA ================= */

  // The card that was clicked, filled in with the full details once they arrive.
  const restaurant = useMemo(() => {
    const base = restaurantProp || {};
    const details =
      loaded.id === base.id ? loaded.details : null;

    if (!details) return base;

    const cover =
      details.photos.find((photo) => photo.type === "cover") ||
      details.photos.find((photo) => photo.type === "logo");

    return {
      ...base,
      name: details.name,
      description: details.description || "",
      type:
        details.cuisines
          .slice(0, 2)
          .map((cuisine) => cuisine.name)
          .join(", ") ||
        base.type ||
        "Restaurant",
      area: details.address.area || base.area || "",
      city: details.address.city || base.city || "",
      address: details.address.full || "",
      image: cover?.url || base.image || placeholderImage,
      logo:
        details.photos.find((photo) => photo.type === "logo")?.url ||
        base.logo ||
        "",
      latitude: details.map?.latitude ?? null,
      longitude: details.map?.longitude ?? null,
      isOpenNow: details.status.is_open_now,
      openStatus: details.status.opening_status,
    };
  }, [restaurantProp, loaded]);

  const { menu, categories } = useMemo(
    () => buildMenu(loaded.menuData),
    [loaded.menuData]
  );

  const restaurantKey = getRestaurantKey(restaurant);

  const selectedFood = menu.find(
    (food) =>
      String(food.id) === String(selectedFoodId)
  );

  const selectedFoodCategories =
    getFoodCategoryIds(selectedFood);

  const initialSelectedCategory =
    initialCategory ||
    selectedFoodCategories[0] ||
    categories[0]?.id ||
    "";

  /* ================= STATES ================= */

  const [activeCategory, setActiveCategory] = useState(
    initialSelectedCategory
  );

  const [currentPage, setCurrentPage] = useState(1);

  const [showReviews, setShowReviews] = useState(false);

  // The "Report this restaurant" popup.
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportError, setReportError] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  const [showRatingModal, setShowRatingModal] =
    useState(false);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewFood, setReviewFood] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [highlightFood, setHighlightFood] =
    useState(null);

  const [categoryOffset, setCategoryOffset] =
    useState(0);

  /* ================= REFS ================= */

  const categoryContainerRef = useRef(null);
  const foodRefs = useRef({});
  const highlightTimerRef = useRef(null);

  /* ================= RESTAURANT STATUS ================= */

  // Worked out by the backend from the owner's opening hours.
  const isOpen = restaurant.isOpenNow === true;

  /* ================= FAVOURITES ================= */

  const isFavorite = favorites.some(
    (item) =>
      getRestaurantKey(item) === restaurantKey
  );

  /* ================= MENU ================= */

  const categoryFoods = getFoodsByCategory(
    activeCategory,
    menu
  );

  const totalPages = Math.max(
    1,
    Math.ceil(categoryFoods.length / ITEMS_PER_PAGE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const visibleFoods = categoryFoods.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  /* ================= DISTANCE ================= */

  // Where the customer is: the position chosen with "near me" (GPS or a typed place).
  const { near } = useSearch();

  const customerLatitude =
    near?.latitude ?? user?.latitude ?? user?.lat ?? null;

  const customerLongitude =
    near?.longitude ?? user?.longitude ?? user?.lng ?? null;

  const hasMapPosition =
    restaurant.latitude != null && restaurant.longitude != null;

  // Opens Google Maps with the route to the restaurant (from the customer when known).
  const directionsUrl = hasMapPosition
    ? `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}${
        customerLatitude != null && customerLongitude != null
          ? `&origin=${customerLatitude},${customerLongitude}`
          : ""
      }`
    : "";

  const mapDetails =
    loaded.id === restaurant.id ? loaded.details?.map : null;

  const distance = calculateDistanceKm(
    customerLatitude,
    customerLongitude,
    restaurant.latitude,
    restaurant.longitude
  );

  /* ================= REVIEWS ================= */

  const reviews = (loaded.reviews || []).map((review) => ({
    id: review.id,
    customerName: review.customer_name,
    rating: review.rating,
    comment: review.comment,
    date: String(review.updated_at || "").slice(0, 10),
  }));

  /* ================= RATING SUMMARY ================= */

  // Average of every rating given (the backend counts them per half star).
  const ratingCounts = Object.entries(
    loaded.ratingCounts || {}
  );

  const totalRatingCount = ratingCounts.reduce(
    (sum, [, count]) => sum + count,
    0
  );

  const averageRating =
    totalRatingCount > 0
      ? (
          ratingCounts.reduce(
            (sum, [stars, count]) =>
              sum + Number(stars) * count,
            0
          ) / totalRatingCount
        ).toFixed(1)
      : "0.0";

  /* ================= RESET ON RESTAURANT CHANGE ================= */

  useEffect(() => {
    const nextFood = menu.find(
      (food) =>
        String(food.id) === String(selectedFoodId)
    );

    const nextCategories =
      getFoodCategoryIds(nextFood);

    const wanted =
      initialCategory &&
      categories.some(
        (category) => category.id === initialCategory
      )
        ? initialCategory
        : null;

    setActiveCategory(
      wanted ||
        nextCategories[0] ||
        categories[0]?.id ||
        ""
    );

    setCurrentPage(1);
    setCategoryOffset(0);
    setHighlightFood(null);

    setShowReviews(false);
    setShowRatingModal(false);

    setReviewRating(0);
    setReviewText("");
    setReviewFood(null);
  }, [
    restaurantId,
    isLoading,
    selectedFoodId,
    initialCategory,
  ]);

  /* ================= SELECTED FOOD PAGE ================= */

  useEffect(() => {
    if (selectedFoodId == null) return;

    const foodIndex = categoryFoods.findIndex(
      (food) =>
        String(food.id) === String(selectedFoodId)
    );

    if (foodIndex < 0) return;

    setCurrentPage(
      Math.floor(foodIndex / ITEMS_PER_PAGE) + 1
    );
  }, [
    selectedFoodId,
    activeCategory,
    isLoading,
  ]);

  /* ================= HIGHLIGHT SELECTED FOOD ================= */

  useEffect(() => {
    if (selectedFoodId == null) return;

    const timer = window.setTimeout(() => {
      const foodElement =
        foodRefs.current[selectedFoodId];

      if (!foodElement) return;

      foodElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      setHighlightFood(selectedFoodId);

      if (highlightTimerRef.current) {
        window.clearTimeout(
          highlightTimerRef.current
        );
      }

      highlightTimerRef.current =
        window.setTimeout(() => {
          setHighlightFood(null);
        }, 3000);
    }, 350);

    return () => {
      window.clearTimeout(timer);

      if (highlightTimerRef.current) {
        window.clearTimeout(
          highlightTimerRef.current
        );
      }
    };
  }, [
    selectedFoodId,
    safePage,
    activeCategory,
    isLoading,
  ]);

  /* ================= MODAL SCROLL LOCK ================= */

  useEffect(() => {
    if (!showReviews && !showRatingModal && !showReportModal) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [showReviews, showRatingModal, showReportModal]);

  /* ================= ESCAPE CLOSE ================= */

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowReviews(false);
        setShowRatingModal(false);
        setShowReportModal(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  /* ================= LOGIN PROTECTION ================= */

  const requireLogin = () => {
    if (isLoggedIn && user) return true;

    window.alert("You must log in first.");
    onLoginClick?.();

    return false;
  };

  const requireCustomer = () => {
    if (!requireLogin()) return false;

    if (
      user?.role === "owner" ||
      user?.role === "admin"
    ) {
      window.alert(
        "Only customer accounts can submit ratings and reviews."
      );

      return false;
    }

    return true;
  };

  /* ================= FAVOURITES ================= */

  const handleFavorite = () => {
    if (!requireCustomer()) return;

    onToggleFavorite?.(restaurant);
  };

  /* ================= SEE REVIEWS ================= */

  const handleSeeReviews = () => {
    if (!requireLogin()) return;

    setShowReviews(true);
  };

  /* ================= RATE RESTAURANT ================= */

  const handleRateUs = () => {
    if (!requireCustomer()) return;

    setReviewFood(null);
    setReviewRating(0);
    setReviewText("");

    setShowReviews(false);
    setShowRatingModal(true);
  };

  /* ================= REPORT THE RESTAURANT ================= */

  const handleReport = () => {
    if (!requireLogin()) return;

    if (user?.role === "owner" || user?.role === "admin") {
      window.alert("Only customer accounts can report a restaurant.");
      return;
    }

    setReportText("");
    setReportError("");
    setShowReviews(false);
    setShowRatingModal(false);
    setShowReportModal(true);
  };

  const submitReport = async (event) => {
    event.preventDefault();

    if (isReporting) return;

    const description = reportText.trim();

    if (!description) {
      setReportError("Please tell us what is wrong.");
      return;
    }

    setIsReporting(true);
    setReportError("");

    const { ok, data } = await apiCall(
      `/api/create_report/${restaurant.id}/`,
      { method: "POST", body: { description } }
    );

    setIsReporting(false);

    if (!ok) {
      setReportError(
        data?.error ||
          "Could not send your report. Please try again."
      );
      return;
    }

    setShowReportModal(false);

    window.alert(
      data?.message || "Thank you. Your report was sent to the admin."
    );
  };

  /* ================= RATE FOOD ================= */

  const handleRateFood = (food) => {
    if (!requireCustomer()) return;

    setReviewFood(food);
    setReviewRating(0);
    setReviewText("");

    setShowReviews(false);
    setShowRatingModal(true);
  };

  /* ================= SUBMIT REVIEW ================= */

  const submitReview = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;
    if (!requireCustomer()) return;

    const rating = clampRating(reviewRating);

    if (rating <= 0) {
      window.alert(
        "Please select a rating before submitting."
      );
      return;
    }

    setIsSubmitting(true);

    // The backend saves it (one review per customer and restaurant / dish).
    const saved = await onSubmitReview?.({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      foodId: reviewFood?.id ?? null,
      foodName: reviewFood?.name ?? "",
      rating,
      comment: reviewText.trim(),
    });

    setIsSubmitting(false);

    if (saved === false) return;

    // Show the new review and the new average.
    setReloadCount((count) => count + 1);

    setReviewText("");
    setReviewRating(0);
    setReviewFood(null);

    setShowRatingModal(false);
    setShowReviews(true);
  };

  /* ================= CATEGORY NAVIGATION ================= */

  const changeCategory = (categoryId) => {
    setActiveCategory(categoryId);
    setCurrentPage(1);
    setHighlightFood(null);
  };

  /* ================= PAGINATION ================= */

  const changePage = useCallback(
    (page) => {
      setCurrentPage(
        Math.max(
          1,
          Math.min(page, totalPages)
        )
      );

      document
        .getElementById("restaurant-menu-results")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    },
    [totalPages]
  );

  /* ================= CATEGORY SCROLL ================= */

  const scrollCategories = (direction) => {
    const container =
      categoryContainerRef.current;

    if (!container) return;

    container.scrollBy({
      left: direction * 230,
      behavior: "smooth",
    });

    setCategoryOffset((previous) =>
      Math.max(0, previous + direction)
    );
  };

  /* ================= FOOD RATING ================= */

  // The rating most customers gave the dish (worked out by the backend).
  const getFoodRating = (food) =>
    (Number(food.rating) || 0).toFixed(1);

  /* ================= RENDER ================= */

  return (
    <div className="restaurant-details-page">
      {/* ================= NAVBAR ================= */}

      <Navbar
        onLoginClick={onLoginClick}
        onHomeClick={onHomeClick}
        onExploreClick={onExploreClick}
        onCuisineClick={onCuisineClick}
        onDealsClick={onDealsClick}
        onAboutClick={onAboutClick}
        isLoggedIn={isLoggedIn}
        user={user}
        onProfileClick={onProfileClick}
        onFavoritesClick={onFavoritesClick}
        onReviewsClick={onReviewsClick}
        onLogout={onLogout}
        onLogoutClick={onLogoutClick}
      />

      <main className="restaurant-details-main">
        {/* ================= RESTAURANT HERO ================= */}

        <section className="restaurant-details-hero">
          <div className="restaurant-details-top">
            <div className="restaurant-details-image">
              <img
                src={restaurant.image}
                alt={restaurant.name}
              />

              <button
                type="button"
                className={`restaurant-details-heart ${
                  isFavorite ? "is-liked" : ""
                }`}
                onClick={handleFavorite}
                aria-label={
                  isFavorite
                    ? "Remove from favourites"
                    : "Add to favourites"
                }
              >
                {isFavorite ? "♥" : "♡"}
              </button>
            </div>

            <div className="restaurant-details-info">
              <div className="restaurant-details-name">
                {restaurant.logo && (
                  <img
                    className="restaurant-details-logo"
                    src={restaurant.logo}
                    alt=""
                  />
                )}

                <h1>{restaurant.name}</h1>
              </div>

              <p className="restaurant-details-description">
                {restaurant.description}
              </p>

              <p className="restaurant-details-meta">
                <strong>{restaurant.type}</strong>
                {" · "}
                <strong>{restaurant.area}</strong>

                {distance != null && (
                  <span>
                    {" "}
                    📍 {formatDistance(distance)} away
                  </span>
                )}

              </p>

              <p className="restaurant-details-address">
                📍 {restaurant.address}
              </p>

              <div className="restaurant-details-rating-row">
                <span
                  className={`restaurant-open-status ${
                    isOpen ? "open" : "closed"
                  }`}
                >
                  ● {isOpen ? "Open now" : "Closed"}
                </span>

                <span className="restaurant-rating-number">
                  ★ {averageRating}
                </span>

                <span className="restaurant-rating-count">
                  ({totalRatingCount})
                </span>

                <button
                  type="button"
                  className="restaurant-action-button restaurant-action-outline"
                  onClick={handleSeeReviews}
                >
                  💬 See Reviews
                </button>

                <button
                  type="button"
                  className="restaurant-action-button restaurant-action-solid"
                  onClick={handleRateUs}
                >
                  ★ Rate this restaurant
                </button>

                <button
                  type="button"
                  className="restaurant-text-button"
                  onClick={handleReport}
                >
                  🚩 Report
                </button>
              </div>
            </div>

            {/* ================= MAP ================= */}

            <div className="restaurant-details-map">
              {hasMapPosition && mapDetails?.embed_url ? (
                <>
                  <div className="restaurant-location-map">
                    <iframe
                      title={`Map of ${restaurant.name}`}
                      loading="lazy"
                      src={mapDetails.embed_url}
                    />
                  </div>

                  <div className="restaurant-location-actions">
                    <a
                      className="restaurant-location-button"
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get directions
                    </a>
                  </div>
                </>
              ) : (
                !isLoading && (
                  <p className="restaurant-location-empty">
                    This restaurant has not put itself on the map yet.
                  </p>
                )
              )}
            </div>
          </div>

          {/* ================= MENU CATEGORIES ================= */}

          <div className="restaurant-menu-navigation">
            {categoryOffset > 0 && (
              <button
                type="button"
                className="restaurant-category-arrow"
                onClick={() =>
                  scrollCategories(-1)
                }
                aria-label="Previous categories"
              >
                «
              </button>
            )}

            <div
              className="restaurant-category-list"
              ref={categoryContainerRef}
            >
              {categories.map((category) => {
                const available =
                  isCategoryAvailable(
                    category.id,
                    menu
                  );

                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`restaurant-category-button ${
                      activeCategory === category.id
                        ? "active"
                        : ""
                    } ${
                      !available ? "unavailable" : ""
                    }`}
                    onClick={() =>
                      changeCategory(category.id)
                    }
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="restaurant-category-arrow"
              onClick={() =>
                scrollCategories(1)
              }
              aria-label="Next categories"
            >
              »
            </button>
          </div>
        </section>

        {/* ================= FOOD MENU ================= */}

        <section
          className="restaurant-menu-layout"
          id="restaurant-menu-results"
        >
          <aside className="restaurant-menu-sidebar">
            <Filters />
          </aside>

          <div className="restaurant-menu-content">
            <div className="restaurant-menu-heading">
              <h2>
                {categories.find(
                  (category) =>
                    category.id === activeCategory
                )?.name || "Menu"}
              </h2>

              <p>
                Discover delicious food from{" "}
                {restaurant.name}.
              </p>
            </div>

            {visibleFoods.length > 0 ? (
              <div className="restaurant-food-list">
                {visibleFoods.map((food) => (
                  <article
                    key={food.id}
                    ref={(element) => {
                      foodRefs.current[food.id] =
                        element;
                    }}
                    className={`restaurant-food-card ${
                      String(highlightFood) ===
                      String(food.id)
                        ? "food-highlight"
                        : ""
                    }`}
                  >
                    <div className="restaurant-food-image">
                      <img
                        src={food.image}
                        alt={food.name}
                      />

                      {food.discount && (
                        <span className="restaurant-food-discount">
                          {food.discount}
                        </span>
                      )}

                      <span
                        className={`restaurant-food-availability ${
                          food.available
                            ? "available"
                            : "not-available"
                        }`}
                      >
                        ●{" "}
                        {food.available
                          ? "Available"
                          : "Not available"}
                      </span>
                    </div>

                    <div className="restaurant-food-info">
                      <h3>{food.name}</h3>

                      <p>{food.description}</p>

                      <div className="restaurant-food-bottom">
                        <span className="restaurant-food-rating">
                          ★ {getFoodRating(food)}
                        </span>

                        <strong>
                          ৳{food.price}
                        </strong>

                        {food.oldPrice != null && (
                          <del>
                            ৳{food.oldPrice}
                          </del>
                        )}
                      </div>

                      <button
                        type="button"
                        className="restaurant-action-button restaurant-action-outline"
                        onClick={() =>
                          handleRateFood(food)
                        }
                        style={{
                          marginTop: "10px",
                          alignSelf: "flex-start",
                        }}
                      >
                        ★ Rate This Food
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="restaurant-menu-empty">
                <h3>
                  {isLoading
                    ? "Loading menu..."
                    : loadError
                      ? "Something went wrong"
                      : "No food items in this category"}
                </h3>

                <p>
                  {loadError ||
                    (isLoading
                      ? "Please wait a moment."
                      : "This restaurant has not added any food items here yet.")}
                </p>
              </div>
            )}

            {/* ================= PAGINATION ================= */}

            <div className="restaurant-menu-pagination">
              <p>
                Showing{" "}
                {categoryFoods.length
                  ? (safePage - 1) *
                      ITEMS_PER_PAGE +
                    1
                  : 0}
                –
                {Math.min(
                  safePage * ITEMS_PER_PAGE,
                  categoryFoods.length
                )}{" "}
                of {categoryFoods.length} items
              </p>

              <div className="restaurant-pagination-buttons">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() =>
                    changePage(safePage - 1)
                  }
                >
                  «
                </button>

                <button
                  type="button"
                  className="active"
                  aria-current="page"
                >
                  {safePage}
                </button>

                <button
                  type="button"
                  disabled={
                    safePage === totalPages
                  }
                  onClick={() =>
                    changePage(safePage + 1)
                  }
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* ================= REVIEWS MODAL ================= */}

      {showReviews && (
        <div
          className="restaurant-modal-overlay"
          onClick={() => setShowReviews(false)}
        >
          <div
            className="restaurant-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Customer reviews"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="restaurant-modal-close"
              onClick={() =>
                setShowReviews(false)
              }
              aria-label="Close reviews"
            >
              ×
            </button>

            <h2>Customer Reviews</h2>

            <p>
              ★ {averageRating} ·{" "}
              {totalRatingCount} ratings
            </p>

            <div className="restaurant-reviews-list">
              {reviews.length ? (
                reviews.map((review, index) => (
                  <div
                    key={
                      review.id ??
                      `review-${index}`
                    }
                    className="restaurant-review-item"
                  >
                    <strong>
                      {review.customerName ||
                        review.name ||
                        "Customer"}
                    </strong>

                    {(review.foodName ||
                      review.reviewType ===
                        "food") && (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#8f2a18",
                          fontWeight: 700,
                          margin: "6px 0",
                        }}
                      >
                        Food:{" "}
                        {review.foodName ||
                          "Menu Item"}
                      </p>
                    )}

                    <RatingStars
                      rating={review.rating}
                    />

                    <p>
                      {review.comment ??
                        review.review ??
                        ""}
                    </p>

                    <small>
                      {getReviewDate(review)}
                    </small>
                  </div>
                ))
              ) : (
                <p>
                  No customer reviews yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= REPORT MODAL ================= */}

      {showReportModal && (
        <div
          className="restaurant-modal-overlay"
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="restaurant-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Report restaurant"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="restaurant-modal-close"
              onClick={() => setShowReportModal(false)}
              aria-label="Close report"
            >
              ×
            </button>

            <h2>Report {restaurant.name}</h2>

            <p
              style={{
                fontSize: "13px",
                color: "#666",
                marginTop: "5px",
              }}
            >
              Tell the NearBite team what is wrong, for example
              wrong opening hours, wrong prices or a food safety
              problem. Only the admin sees this.
            </p>

            <form onSubmit={submitReport}>
              <textarea
                value={reportText}
                onChange={(event) => {
                  setReportText(event.target.value);
                  setReportError("");
                }}
                placeholder="What is wrong with this restaurant?"
                rows={5}
                maxLength={1000}
              />

              {reportError && (
                <p
                  role="alert"
                  style={{
                    margin: "8px 0 0",
                    color: "#c62828",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {reportError}
                </p>
              )}

              <button
                type="submit"
                className="restaurant-submit-review"
                disabled={isReporting}
              >
                {isReporting ? "Sending..." : "Send Report"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= RATING MODAL ================= */}

      {showRatingModal && (
        <div
          className="restaurant-modal-overlay"
          onClick={() =>
            setShowRatingModal(false)
          }
        >
          <div
            className="restaurant-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              reviewFood
                ? "Rate food"
                : "Rate restaurant"
            }
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="restaurant-modal-close"
              onClick={() =>
                setShowRatingModal(false)
              }
              aria-label="Close rating"
            >
              ×
            </button>

            <h2>
              {reviewFood
                ? `Rate ${reviewFood.name}`
                : `Rate ${restaurant.name}`}
            </h2>

            {reviewFood && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#666",
                  marginTop: "5px",
                }}
              >
                Share your experience with this
                food item.
              </p>
            )}

            <form onSubmit={submitReview}>
              <div className="restaurant-rating-stars">
                <RatingStars
                  rating={reviewRating}
                  interactive
                  onChange={setReviewRating}
                  onClear={() =>
                    setReviewRating(0)
                  }
                />
              </div>

              <textarea
                value={reviewText}
                onChange={(event) =>
                  setReviewText(
                    event.target.value
                  )
                }
                placeholder={
                  reviewFood
                    ? `How was ${reviewFood.name}? (Optional)`
                    : "Write your experience... (Optional)"
                }
                rows={5}
              />

              <button
                type="submit"
                className="restaurant-submit-review"
              >
                Submit Review
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
