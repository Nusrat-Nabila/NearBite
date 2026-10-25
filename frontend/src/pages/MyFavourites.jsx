
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import "./MyFavourites.css";

function getRestaurantKey(restaurant) {
  return String(
    restaurant.id ??
      `${restaurant.name}-${restaurant.area ?? ""}-${restaurant.type ?? ""}`
  );
}

export default function MyFavourites({
  favorites = [],
  onToggleFavorite,

  // Restaurant details navigation from App.jsx
  onRestaurantClick,
  onRestaurantDetailsClick,

  // Main navigation
  onLoginClick,
  onHomeClick,
  onExploreClick,
  onCuisineClick,
  onDealsClick,
  onAboutClick,

  // User dropdown navigation
  onFavoritesClick,
  onProfileClick,
  onReviewsClick,
  onSettingsClick,
  onLogout,
  onLogoutClick,

  // Shared login state
  user = null,
  isLoggedIn = false,
}) {
  // Open the selected restaurant's own details/menu page
  const openRestaurantDetails = (restaurant) => {
    if (!restaurant) return;

    const handleOpen =
      onRestaurantClick || onRestaurantDetailsClick;

    if (handleOpen) {
      handleOpen(restaurant);
    }
  };

  // Remove restaurant from favourites
  const removeFavorite = (event, restaurant) => {
    event.stopPropagation();

    onToggleFavorite?.(restaurant);
  };

  // Keyboard support for clickable cards
  const handleCardKeyDown = (event, restaurant) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRestaurantDetails(restaurant);
    }
  };

  return (
    <div className="favourites-page">
      {/* Navbar */}
      <Navbar
        onLoginClick={onLoginClick}
        onHomeClick={onHomeClick}
        onExploreClick={onExploreClick}
        onCuisineClick={onCuisineClick}
        onDealsClick={onDealsClick}
        onAboutClick={onAboutClick}
        onFavoritesClick={onFavoritesClick}
        onProfileClick={onProfileClick}
        onReviewsClick={onReviewsClick}
        onSettingsClick={onSettingsClick}
        onLogout={onLogout}
        onLogoutClick={onLogoutClick}
        user={user}
        isLoggedIn={isLoggedIn}
      />

      <main className="favourites-main">
        <div className="favourites-container">
          {/* Page heading */}
          <header className="favourites-heading">
            <span className="favourites-eyebrow">
              YOUR ACCOUNT
            </span>

            <h1>My Favourites</h1>

            <p>
              Restaurants and dishes you've saved for later.
            </p>
          </header>

          {favorites.length > 0 ? (
            <>
              {/* Saved restaurants toolbar */}
              <div className="favourites-toolbar">
                <span>
                  <span className="favourites-heart-icon">
                    ♥
                  </span>
                  Saved Restaurants
                </span>

                <span className="favourites-count">
                  {favorites.length}{" "}
                  {favorites.length === 1
                    ? "restaurant"
                    : "restaurants"}
                </span>
              </div>

              {/* Favourite restaurant cards */}
              <div className="favourites-grid">
                {favorites.map((restaurant) => {
                  const key = getRestaurantKey(restaurant);

                  // Use the restaurant's provided status.
                  // If no status is supplied, do not assume it is open.
                  const hasOpenStatus =
                    typeof restaurant.isOpen === "boolean";

                  const isOpen = restaurant.isOpen === true;

                  return (
                    <article
                      className="favourite-card"
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${restaurant.name} restaurant details`}
                      onClick={() =>
                        openRestaurantDetails(restaurant)
                      }
                      onKeyDown={(event) =>
                        handleCardKeyDown(event, restaurant)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      {/* Restaurant image */}
                      <div className="favourite-card-image">
                        <img
                          src={restaurant.image}
                          alt={restaurant.name}
                          loading="lazy"
                        />

                        {/* Discount */}
                        {restaurant.off && (
                          <span className="favourite-deal">
                            {restaurant.off} OFF
                          </span>
                        )}

                        {/* Remove favourite */}
                        <button
                          type="button"
                          className="favourite-heart favourite-heart-active"
                          aria-label={`Remove ${restaurant.name} from favourites`}
                          title="Remove from favourites"
                          onClick={(event) =>
                            removeFavorite(event, restaurant)
                          }
                        >
                          ♥
                        </button>

                        {/* Restaurant opening status */}
                        {hasOpenStatus && (
                          <span
                            className={`favourite-open-tag ${
                              !isOpen
                                ? "favourite-closed"
                                : ""
                            }`}
                          >
                            <span>●</span>{" "}
                            {isOpen ? "Open now" : "Closed"}
                          </span>
                        )}
                      </div>

                      {/* Restaurant information */}
                      <div className="favourite-card-body">
                        <div className="favourite-card-title">
                          <h3>{restaurant.name}</h3>

                          <span className="favourite-rating">
                            ★ {restaurant.rating ?? "New"}
                          </span>
                        </div>

                        {/* Cuisine and location */}
                        <p className="favourite-category">
                          {[
                            restaurant.type,
                            restaurant.area,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>

                        {/* Popular dish */}
                        {restaurant.dish && (
                          <p className="favourite-dish">
                            {restaurant.dish}
                          </p>
                        )}

                        {/* Price */}
                        {restaurant.price != null && (
                          <p className="favourite-price">
                            <strong>
                              ৳{restaurant.price}
                            </strong>

                            {restaurant.old != null && (
                              <del>৳{restaurant.old}</del>
                            )}
                          </p>
                        )}

                        {/* Open the correct restaurant menu */}
                        <button
                          type="button"
                          className="favourite-menu-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openRestaurantDetails(restaurant);
                          }}
                        >
                          View menu →
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            /* Empty favourites state */
            <section className="favourites-empty">
              <div className="favourites-empty-icon">
                ♥
              </div>

              <h2>No favourites yet</h2>

              <p>
                You haven't saved any restaurants yet.
                Explore restaurants and tap the heart to
                save your favourites here.
              </p>

              <button
                type="button"
                className="favourites-browse-button"
                onClick={() => onExploreClick?.()}
              >
                Explore Restaurants →
              </button>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
