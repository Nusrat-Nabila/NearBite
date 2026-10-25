
import { useEffect, useState } from "react";

import Reveal from "../components/Reveal";
import Navbar from "../components/Navbar";
import Filters from "../components/Filters";
import Footer from "../components/Footer";

import { apiCall, errorMessage } from "../api";
import { loadFilterOptions } from "../filterOptions";
import { pictureFor } from "../cuisinePictures";
import { toRestaurantCard } from "../restaurantMapper";

import cuisineBanner from "../Image/cuisines-banner.jpg";

import "./Cuisines.css";

const ITEMS_PER_PAGE = 12;

// ================= HELPERS =================

// Keep restaurant identity consistent with Home and Explore.
const getRestaurantKey = (restaurant) =>
  String(
    restaurant.id ??
      `${restaurant.name}-${restaurant.area ?? ""}-${restaurant.type ?? ""}`
  );

// ================= COMPONENT =================

export default function Cuisines({
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

  // The cuisine (slug) picked on the Home page, if any
  initialCuisine = null,
}) {
  // Every cuisine the admin manages, from the backend.
  const [cuisineItems, setCuisineItems] = useState([]);

  // The cuisine whose restaurants are shown (null until the list arrives).
  const [selectedCuisine, setSelectedCuisine] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);

  // The restaurants of the selected cuisine, one page of them.
  const [restaurants, setRestaurants] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchError, setSearchError] = useState("");

  // Scroll to top when page mounts.
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, []);

  // Load the cuisines. Bangladeshi is shown first, as before; otherwise the first cuisine.
  useEffect(() => {
    let active = true;

    loadFilterOptions().then((options) => {
      if (!active || !options) return;

      const items = options.cuisines.map((cuisine) => ({
        name: cuisine.name,
        slug: cuisine.slug,
        image: pictureFor(cuisine.name),
      }));

      setCuisineItems(items);

      // The cuisine clicked on Home, else Bangladeshi, else the first one.
      setSelectedCuisine(
        items.find((item) => item.slug === initialCuisine) ||
          items.find((item) => item.slug === "bangladeshi") ||
          items[0] ||
          null
      );

      // Coming from a click on Home: show the restaurants of that cuisine.
      if (initialCuisine) {
        window.setTimeout(() => {
          document
            .getElementById("cuisine-results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 400);
      }
    });

    return () => {
      active = false;
    };
  }, [initialCuisine]);

  // Load the restaurants of the selected cuisine.
  useEffect(() => {
    if (!selectedCuisine) return undefined;

    let active = true;

    apiCall(
      `/api/search_restaurant/?cuisine=${encodeURIComponent(
        selectedCuisine.slug
      )}&page=${currentPage}&page_size=${ITEMS_PER_PAGE}`,
      { auth: false }
    ).then(({ ok, data }) => {
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
    });

    return () => {
      active = false;
    };
  }, [selectedCuisine, currentPage]);

  // ================= NAVIGATION =================

  const openRestaurant = (restaurant) => {
    const handleOpen =
      onRestaurantClick || onRestaurantDetailsClick;

    handleOpen?.(restaurant);
  };

  // ================= FAVOURITES =================

  const isRestaurantFavorite = (restaurant) =>
    favorites.some(
      (item) =>
        getRestaurantKey(item) ===
        getRestaurantKey(restaurant)
    );

  const toggleFavourite = (restaurant) => {
    onToggleFavorite?.(restaurant);
  };

  // ================= CUISINE FILTER =================

  // ================= PAGINATION =================

  const safePage = Math.min(currentPage, totalPages);

  const visibleRestaurants = restaurants;

  const changeCuisine = (cuisine) => {
    setIsLoading(true);
    setSelectedCuisine(cuisine);
    setCurrentPage(1);
  };

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

  return (
    <div
      className="cuisine-page"
      id="cuisines-page"
    >
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

      <main className="cuisine-main">
        {/* ================= HERO BANNER ================= */}
        <Reveal className="cuisine-hero-reveal">
          <section
            className="cuisine-hero"
            style={{
              backgroundImage: `url(${cuisineBanner})`,
            }}
          >
            <div className="cuisine-hero-content">
              <h1>
                Explore <span>Cuisines</span>
              </h1>

              <p>
                Discover restaurants by your favourite cuisine
              </p>
            </div>
          </section>
        </Reveal>

        {/* ================= CUISINE SELECTION ================= */}
        <Reveal delay={80}>
          <section className="cuisine-favourites">
            <div className="cuisine-section-heading">
              <h2>Your favourite cuisines</h2>

              <p>
                Choose a cuisine to discover delicious food.
              </p>
            </div>

            <div className="cuisine-grid">
              {cuisineItems.map((cuisine, index) => {
                const isSelected =
                  selectedCuisine?.slug === cuisine.slug;

                return (
                  <Reveal
                    key={cuisine.slug}
                    delay={(index % 5) * 60}
                    className="cuisine-item-reveal"
                  >
                    <button
                      type="button"
                      className={`cuisine-choice ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() =>
                        changeCuisine(cuisine)
                      }
                      aria-pressed={isSelected}
                    >
                      <div className="cuisine-choice-image">
                        {cuisine.image ? (
                          <img
                            src={cuisine.image}
                            alt={cuisine.name}
                            loading="lazy"
                          />
                        ) : (
                          <span
                            className="cuisine-fallback"
                            aria-hidden="true"
                          >
                            {cuisine.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <span>{cuisine.name}</span>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </section>
        </Reveal>

        {/* ================= FILTERS + RESULTS ================= */}
        <section
          className="cuisine-results-layout"
          id="cuisine-results"
        >
          {/* Sidebar filters */}
          <aside className="cuisine-sidebar">
            <Reveal delay={80}>
              <Filters />
            </Reveal>
          </aside>

          {/* Restaurant results */}
          <div className="cuisine-results">
            <Reveal delay={100}>
              <header className="cuisine-results-heading">
                <h2>
                  Restaurants Serving {selectedCuisine?.name} Items
                </h2>

                <p>
                  Authentic flavours, right near you
                </p>
              </header>
            </Reveal>

            {isLoading ? (
              <div className="cuisine-empty">
                <h3>Loading restaurants...</h3>
              </div>
            ) : visibleRestaurants.length > 0 ? (
              <div className="cuisine-restaurant-grid">
                {visibleRestaurants.map(
                  (restaurant, index) => {
                    const cardId = `${
                      selectedCuisine?.slug
                    }-${getRestaurantKey(
                      restaurant
                    )}-${index}`;

                    const isFavorite =
                      isRestaurantFavorite(
                        restaurant
                      );

                    const hasOpeningHours =
                      restaurant.openStatus !==
                      "hours_not_set";

                    const isOpen = restaurant.isOpenNow;

                    return (
                      <Reveal
                        key={cardId}
                        delay={(index % 4) * 80}
                        className="cuisine-card-reveal"
                      >
                        <article className="cuisine-restaurant-card">
                          {/* Restaurant image */}
                          <div
                            className="cuisine-card-image"
                            onClick={() =>
                              openRestaurant(
                                restaurant
                              )
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
                              <span className="cuisine-discount">
                                {restaurant.off} OFF
                              </span>
                            )}

                            {/* Favourite heart */}
                            <button
                              type="button"
                              className={`cuisine-heart ${
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
                            >
                              {isFavorite
                                ? "♥"
                                : "♡"}
                            </button>

                            {/* Demo open/closed status */}
                            {hasOpeningHours && (
                              <span
                                className={`cuisine-status ${
                                  isOpen
                                    ? "open"
                                    : "closed"
                                }`}
                              >
                                <span className="cuisine-status-dot" />

                                {isOpen
                                  ? "Open now"
                                  : "Closed"}
                              </span>
                            )}
                          </div>

                          {/* Restaurant details */}
                          <div className="cuisine-card-body">
                            <div className="cuisine-card-title-row">
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

                              <span className="cuisine-rating">
                                ★ {restaurant.rating}
                              </span>
                            </div>

                            <p className="cuisine-card-location">
                              {restaurant.type}
                              {restaurant.area
                                ? ` · ${restaurant.area}`
                                : ""}
                            </p>

                            {restaurant.dish && (
                              <p className="cuisine-card-dish">
                                {restaurant.dish}
                              </p>
                            )}

                            <div className="cuisine-card-bottom">
                              {restaurant.price != null && (
                                <div className="cuisine-card-price">
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

                              {/* Connected menu button */}
                              <button
                                type="button"
                                className="cuisine-menu-button"
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
            ) : (
              /* Existing empty state */
              <div className="cuisine-empty">
                <span aria-hidden="true">
                  🍽️
                </span>

                <h3>
                  No {selectedCuisine?.name} restaurants found
                </h3>

                <p>
                  {searchError ||
                    "Try another cuisine to discover more restaurants."}
                </p>

                {cuisineItems[0] && (
                  <button
                    type="button"
                    onClick={() =>
                      changeCuisine(cuisineItems[0])
                    }
                  >
                    Explore {cuisineItems[0].name}
                  </button>
                )}
              </div>
            )}

            {/* ================= PAGINATION ================= */}
            <Reveal>
              <div className="cuisine-pagination">
                <p>
                  Showing{" "}
                  {totalCount
                    ? (safePage - 1) *
                        ITEMS_PER_PAGE +
                      1
                    : 0}
                  –
                  {Math.min(
                    safePage * ITEMS_PER_PAGE,
                    totalCount
                  )}{" "}
                  of {totalCount} restaurants
                </p>

                <div className="cuisine-pagination-controls">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={
                      safePage === 1
                    }
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
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <Footer />
    </div>
  );
}
