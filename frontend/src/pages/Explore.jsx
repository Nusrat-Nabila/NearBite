
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Reveal from "../components/Reveal";
import Navbar from "../components/Navbar";
import Filters from "../components/Filters";
import Footer from "../components/Footer";

import { apiCall, errorMessage } from "../api";
import {
  loadFilterOptions,
  toSlugs,
  toValues,
} from "../filterOptions";
import { toRestaurantCard } from "../restaurantMapper";
import { useSearch } from "../searchContext";
import {
  formatDistance,
  locateByGps,
  locateByPlace,
} from "../nearMe";

import exploreBanner from "../Image/explore-banner.jpg";

import "./Explore.css";

const ITEMS_PER_PAGE = 12;

// Wait a little after the last filter change (price typing) before asking the backend.
const SEARCH_DELAY_MS = 300;

/* ================= HELPERS ================= */

const getRestaurantKey = (restaurant) =>
  String(
    restaurant.id ??
      `${restaurant.name}-${restaurant.area ?? ""}-${restaurant.type ?? ""}`
  );

const getSelectedItems = (selected, key) =>
  Array.isArray(selected?.[key])
    ? selected[key].filter(
        (item) =>
          String(item).trim().toLowerCase() !== "all"
      )
    : [];

// The filter panel's choices -> the URL of GET /api/search_restaurant/.
function buildSearchQuery(filters, options, page, words, geo) {
  const selected = filters?.selected || {};
  const query = new URLSearchParams();

  // The words typed in the top bar (and the area chosen there).
  if (words) query.set("q", words);

  // Category = kind of dish (Pizza, Burger ...). Cuisine = where the food is from (Thai, Italian ...).
  const categories = toSlugs(
    options?.categories,
    getSelectedItems(selected, "Category")
  );

  const cuisines = toSlugs(
    options?.cuisines,
    getSelectedItems(selected, "Cuisine")
  );

  const dietary = toSlugs(
    options?.dietary_tags,
    getSelectedItems(selected, "Dietary Tags")
  );

  const meals = toValues(
    options?.meal_types,
    getSelectedItems(selected, "Meal type")
  );

  const occasions = toValues(
    options?.dining_occasions,
    getSelectedItems(selected, "Good for")
  );

  if (categories.length) query.set("category", categories.join(","));
  if (cuisines.length) query.set("cuisine", cuisines.join(","));
  if (dietary.length) query.set("dietary", dietary.join(","));
  if (meals.length) query.set("meal", meals.join(","));
  if (occasions.length) query.set("occasion", occasions.join(","));

  if (String(filters?.minPrice ?? "") !== "") {
    query.set("min_price", String(filters.minPrice));
  }

  if (String(filters?.maxPrice ?? "") !== "") {
    query.set("max_price", String(filters.maxPrice));
  }

  if (filters?.openNow) query.set("open_now", "true");

  // Where the customer is: only restaurants within the radius, and the distance of each.
  if (geo?.near) {
    query.set("lat", String(geo.near.latitude));
    query.set("lng", String(geo.near.longitude));

    if (geo.radius) query.set("radius_km", String(geo.radius));
  }

  // "nearest" needs a position; without one the list stays in name order.
  const sort = geo?.sort || (geo?.near ? "nearest" : "name");

  query.set("sort", sort === "nearest" && !geo?.near ? "name" : sort);

  query.set("page", String(page));
  query.set("page_size", String(ITEMS_PER_PAGE));

  return query.toString();
}

/* ================= EXPLORE COMPONENT ================= */

export default function Explore({
  // Main navigation
  onLoginClick,
  onHomeClick,
  onExploreClick,
  onCuisineClick,
  onDealsClick,
  onAboutClick,

  // Shared login state
  isLoggedIn = false,
  user = null,

  // Shared favourites
  favorites = [],
  onToggleFavorite,

  // User dropdown navigation
  onProfileClick,
  onFavoritesClick,
  onReviewsClick,
  onSettingsClick,
  onLogout,
  onLogoutClick,

  // Restaurant Details navigation
  onRestaurantClick,
  onRestaurantDetailsClick,
}) {
  // What was searched for in the top bar: every word must match a restaurant, dish, cuisine ...
  const { text: searchText, location: searchLocation } = useSearch();

  const searchWords = [searchText, searchLocation]
    .filter(Boolean)
    .join(" ");

  const { near, setNear } = useSearch();

  // "Near me": the radius (km, "" = any distance), the sort ("" = nearest when a position is known).
  const [radius, setRadius] = useState("");
  const [sort, setSort] = useState("");
  const [placeText, setPlaceText] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [nearError, setNearError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    selected: {
      Category: ["All"],
    },
    minPrice: "",
    maxPrice: "",
    openNow: false,
  });

  // The restaurants of the current page, as the backend answered.
  const [restaurants, setRestaurants] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchError, setSearchError] = useState("");

  /* ================= SCROLL ON MOUNT ================= */

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, []);

  /* ================= RECEIVE FILTER CHANGES ================= */

  const handleFilterChange = useCallback((nextFilters) => {
    setFilters(nextFilters);
    setCurrentPage(1);
  }, []);

  /* ================= NEAR ME ================= */

  const applyPosition = (position) => {
    setNear(position);
    setSort("");
    setCurrentPage(1);
    setNearError("");
  };

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    setNearError("");

    try {
      applyPosition(await locateByGps());
      setPlaceText("");
    } catch (error) {
      setNearError(error.message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleFindPlace = async (event) => {
    event.preventDefault();

    setIsLocating(true);
    setNearError("");

    try {
      applyPosition(await locateByPlace(placeText));
    } catch (error) {
      setNearError(error.message);
    } finally {
      setIsLocating(false);
    }
  };

  const clearPosition = () => {
    setNear(null);
    setRadius("");
    setSort("");
    setPlaceText("");
    setNearError("");
    setCurrentPage(1);
  };

  /* ================= SEARCH THE BACKEND ================= */

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setIsLoading(true);

      const options = await loadFilterOptions();

      const { ok, data } = await apiCall(
        `/api/search_restaurant/?${buildSearchQuery(
          filters,
          options,
          currentPage,
          searchWords,
          { near, radius, sort }
        )}`,
        { auth: false }
      );

      if (!active) return;

      if (ok) {
        setRestaurants(data.results.map(toRestaurantCard));
        setTotalCount(data.count);
        setTotalPages(data.total_pages);
        setSearchError("");
      } else {
        setRestaurants([]);
        setTotalCount(0);
        setTotalPages(1);
        setSearchError(
          errorMessage(
            data,
            "Could not load restaurants. Please try again."
          )
        );
      }

      setIsLoading(false);
    }, SEARCH_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters, currentPage, searchWords, near, radius, sort]);

  /* ================= RESTAURANT NAVIGATION ================= */

  const openRestaurant = (restaurant) => {
    const handleOpen =
      onRestaurantClick ||
      onRestaurantDetailsClick;

    handleOpen?.(restaurant);
  };

  /* ================= FAVOURITES ================= */

  const isRestaurantFavorite = (restaurant) =>
    favorites.some(
      (item) =>
        getRestaurantKey(item) ===
        getRestaurantKey(restaurant)
    );

  const toggleFavourite = (restaurant) => {
    onToggleFavorite?.(restaurant);
  };

  /* ================= PAGINATION ================= */

  const safePage = Math.min(currentPage, totalPages);

  const visibleRestaurants = restaurants;

  const changePage = (page) => {
    const nextPage = Math.max(
      1,
      Math.min(page, totalPages)
    );

    setCurrentPage(nextPage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* ================= UI ================= */

  return (
    <div className="explore-page" id="explore">
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
        onSettingsClick={onSettingsClick}
        onLogout={onLogout}
        onLogoutClick={onLogoutClick}
      />

      <main className="explore-main">
        {/* ================= HERO BANNER ================= */}

        <Reveal className="explore-hero-reveal">
          <section
            className="explore-hero"
            style={{
              backgroundImage: `url(${exploreBanner})`,
            }}
          >
            <div className="explore-hero-overlay" />

            <div className="explore-hero-content">
              <h1>
                Uncover Delicious Bites{" "}
                <span>Nearby</span>
              </h1>

              <p>
                Browse through top-rated restaurants,
                popular cuisines, and handpicked food offers.
              </p>
            </div>
          </section>
        </Reveal>

        {/* ================= HEADING ================= */}

        <Reveal
          delay={100}
          className="explore-heading-reveal"
        >
          <section className="explore-heading">
            <h2>
              Explore Top Restaurants &amp; Foods
            </h2>

            <p>
              Discover local flavors, trending dishes,
              and exclusive deals
            </p>
          </section>
        </Reveal>

        {/* ================= FILTERS + RESULTS ================= */}

        <section className="explore-layout">
          {/* ================= FILTER SIDEBAR ================= */}

          <aside className="explore-sidebar">
            <Reveal
              delay={80}
              className="explore-filter-reveal"
            >
              <Filters
                onFilterChange={handleFilterChange}
              />
            </Reveal>
          </aside>

          {/* ================= RESTAURANT RESULTS ================= */}

          <div className="explore-results">
            {/* ================= NEAR ME ================= */}

            <section className="explore-nearme">
              <div className="explore-nearme-row">
                <button
                  type="button"
                  className="explore-nearme-gps"
                  onClick={handleUseMyLocation}
                  disabled={isLocating}
                >
                  📍 Use my location
                </button>

                <form
                  className="explore-nearme-place"
                  onSubmit={handleFindPlace}
                >
                  <input
                    type="text"
                    value={placeText}
                    onChange={(event) =>
                      setPlaceText(event.target.value)
                    }
                    placeholder="Or type a place, e.g. Dhanmondi, Dhaka"
                    aria-label="Type a place to search near"
                  />

                  <button type="submit" disabled={isLocating}>
                    {isLocating ? "Finding..." : "Find"}
                  </button>
                </form>

                <label className="explore-nearme-sort">
                  Sort by
                  <select
                    value={sort || (near ? "nearest" : "name")}
                    onChange={(event) => {
                      setSort(event.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="name">Name (A-Z)</option>
                    <option value="price_low">
                      Price: low to high
                    </option>
                    <option value="price_high">
                      Price: high to low
                    </option>
                    <option value="nearest" disabled={!near}>
                      Nearest first
                    </option>
                  </select>
                </label>
              </div>

              {nearError && (
                <p className="explore-nearme-error" role="alert">
                  {nearError}
                </p>
              )}

              {near && (
                <div className="explore-nearme-active">
                  <span>
                    Near <strong>{near.label}</strong>
                  </span>

                  <label>
                    Within
                    <select
                      value={radius}
                      onChange={(event) => {
                        setRadius(event.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">Any distance</option>
                      <option value="1">1 km</option>
                      <option value="2">2 km</option>
                      <option value="5">5 km</option>
                      <option value="10">10 km</option>
                      <option value="25">25 km</option>
                    </select>
                  </label>

                  <button type="button" onClick={clearPosition}>
                    ✕ Clear
                  </button>
                </div>
              )}

              {near && (
                <p className="explore-nearme-note">
                  Restaurants that have not put themselves on the map
                  are listed last
                  {radius ? " and hidden while a distance is set" : ""}.
                </p>
              )}
            </section>

            <div className="explore-card-grid">
              {visibleRestaurants.map(
                (restaurant, index) => {
                  const actualIndex =
                    (safePage - 1) *
                      ITEMS_PER_PAGE +
                    index;

                  const cardId = `${
                    getRestaurantKey(restaurant)
                  }-${actualIndex}`;

                  const isFavorite =
                    isRestaurantFavorite(restaurant);

                  const hasOpeningHours =
                    restaurant.openStatus !== "hours_not_set";

                  const isOpen = restaurant.isOpenNow;

                  return (
                    <Reveal
                      key={cardId}
                      delay={(index % 4) * 100}
                      className="explore-card-reveal"
                    >
                      <article className="explore-restaurant-card">
                        {/* ================= IMAGE ================= */}

                        <div
                          className="explore-card-image"
                          onClick={() =>
                            openRestaurant(restaurant)
                          }
                          style={{
                            cursor: "pointer",
                          }}
                        >
                          <img
                            src={restaurant.image}
                            alt={restaurant.name}
                            loading={
                              index > 3
                                ? "lazy"
                                : "eager"
                            }
                          />

                          {restaurant.off && (
                            <span className="explore-discount">
                              {restaurant.off} OFF
                            </span>
                          )}

                          {/* ================= FAVOURITE ================= */}

                          <button
                            type="button"
                            className={`explore-heart ${
                              isFavorite
                                ? "is-liked"
                                : ""
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();

                              toggleFavourite(
                                restaurant
                              );
                            }}
                            aria-label={
                              isFavorite
                                ? `Remove ${restaurant.name} from favourites`
                                : `Add ${restaurant.name} to favourites`
                            }
                            aria-pressed={isFavorite}
                            title={
                              isFavorite
                                ? "Remove from favourites"
                                : "Add to favourites"
                            }
                          >
                            {isFavorite ? "♥" : "♡"}
                          </button>

                          {/* ================= OPEN STATUS ================= */}

                          {hasOpeningHours && (
                            <span
                              className={`explore-status ${
                                isOpen
                                  ? "open"
                                  : "closed"
                              }`}
                            >
                              <span className="explore-status-dot" />

                              {isOpen
                                ? "Open now"
                                : "Closed"}
                            </span>
                          )}
                        </div>

                        {/* ================= CARD BODY ================= */}

                        <div className="explore-card-body">
                          <div className="explore-card-title-row">
                            <h3
                              onClick={() =>
                                openRestaurant(
                                  restaurant
                                )
                              }
                              style={{
                                cursor: "pointer",
                              }}
                            >
                              {restaurant.name}
                            </h3>

                            <span className="explore-rating">
                              ★ {restaurant.rating}
                            </span>
                          </div>

                          <p className="explore-card-location">
                            {restaurant.type} ·{" "}
                            {restaurant.area}
                            {restaurant.distanceKm != null && (
                              <span className="explore-card-distance">
                                {" · "}📍{" "}
                                {formatDistance(
                                  restaurant.distanceKm
                                )}{" "}
                                away
                              </span>
                            )}
                          </p>

                          {restaurant.dish && (
                            <p className="explore-card-dish">
                              {restaurant.dish}
                            </p>
                          )}

                          <div className="explore-card-bottom">
                            {restaurant.price != null && (
                              <div className="explore-card-price">
                                <strong>
                                  ৳{restaurant.price}
                                </strong>

                                {restaurant.old != null && (
                                  <del>
                                    ৳{restaurant.old}
                                  </del>
                                )}
                              </div>
                            )}

                            {/* ================= VIEW MENU ================= */}

                            <button
                              type="button"
                              className="explore-menu-button"
                              onClick={() =>
                                openRestaurant(
                                  restaurant
                                )
                              }
                            >
                              View menu{" "}
                              <span>→</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    </Reveal>
                  );
                }
              )}
            </div>

            {/* ================= NO RESULTS ================= */}

            {!isLoading && totalCount === 0 && (
              <div
                style={{
                  padding: "55px 20px",
                  textAlign: "center",
                  background: "#f7f3ee",
                  borderRadius: "12px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 10px",
                    fontSize: "20px",
                  }}
                >
                  No restaurants found
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "14px",
                  }}
                >
                  {searchError ||
                    "Try changing or clearing your filters."}
                </p>
              </div>
            )}

            {/* ================= PAGINATION ================= */}

            {totalCount > 0 && (
              <Reveal className="explore-pagination-reveal">
                <div className="explore-pagination">
                  <p>
                    Showing{" "}
                    {(safePage - 1) *
                      ITEMS_PER_PAGE +
                      1}
                    –
                    {Math.min(
                      safePage * ITEMS_PER_PAGE,
                      totalCount
                    )}{" "}
                    of {totalCount} restaurants
                  </p>

                  <div className="explore-pagination-controls">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={safePage === 1}
                      onClick={() =>
                        changePage(safePage - 1)
                      }
                    >
                      «
                    </button>

                    <button
                      type="button"
                      className="current"
                      aria-current="page"
                    >
                      {safePage}
                    </button>

                    <button
                      type="button"
                      aria-label="Next page"
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
              </Reveal>
            )}
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}

      <Footer />
    </div>
  );
}
