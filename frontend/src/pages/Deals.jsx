
import { useState, useEffect } from "react";

import Reveal from "../components/Reveal";
import Navbar from "../components/Navbar";
import Filters from "../components/Filters";
import Footer from "../components/Footer";

import { apiCall } from "../api";
import { toDealCard } from "../restaurantMapper";

import dealsBanner from "../Image/deals-banner.jpg";

import "./Deals.css";

// The backend gives at most 50 deals at a time (the best offer of each restaurant).
const DEALS_LIMIT = 50;

const ITEMS_PER_PAGE = 12;

// ================= COMPONENT =================

export default function Deals({
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
  onDealClick,
  onDealDetailsClick,
}) {
  const [currentPage, setCurrentPage] = useState(1);

  // Today's deals, from the backend.
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Existing selected-state styling preserved.
  const [claimedDeals, setClaimedDeals] = useState({});

  useEffect(() => {
    let active = true;

    apiCall(`/api/list_daily_deals/?limit=${DEALS_LIMIT}`, {
      auth: false,
    }).then(({ ok, data }) => {
      if (!active) return;

      if (ok) setDeals(data.map(toDealCard));

      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, []);

  // ================= PAGINATION =================

  const totalPages = Math.max(
    1,
    Math.ceil(deals.length / ITEMS_PER_PAGE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const visibleDeals = deals.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const changePage = (page) => {
    const nextPage = Math.max(
      1,
      Math.min(page, totalPages)
    );

    setCurrentPage(nextPage);

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  };

  // ================= DEAL NAVIGATION =================

  const grabDeal = (deal) => {
    const restaurant = deal.restaurant;

    if (!restaurant) {
      window.alert(
        "This deal has not been linked to a restaurant yet."
      );
      return;
    }

    const handleDealOpen =
      onDealClick || onDealDetailsClick;

    if (handleDealOpen) {
      // Mark selected only when navigation is available.
      setClaimedDeals((previous) => ({
        ...previous,
        [deal.id]: true,
      }));

      // The first dish on the deal is highlighted on the restaurant's page.
      handleDealOpen(
        restaurant,
        deal.foodId != null
          ? { foodId: deal.foodId }
          : null
      );

      return;
    }

    // Fallback: open restaurant details if only
    // restaurant navigation was provided.
    const handleRestaurantOpen =
      onRestaurantClick ||
      onRestaurantDetailsClick;

    if (handleRestaurantOpen) {
      setClaimedDeals((previous) => ({
        ...previous,
        [deal.id]: true,
      }));

      handleRestaurantOpen(restaurant);
    }
  };

  return (
    <div className="deals-page" id="deals">
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

      <main className="deals-main">
        {/* ================= HERO BANNER ================= */}
        <Reveal className="deals-hero-reveal">
          <section
            className="deals-hero"
            style={{
              backgroundImage: `url(${dealsBanner})`,
            }}
          >
            <div className="deals-hero-overlay" />

            <div className="deals-hero-content">
              <span className="deals-hero-icon">
                🔥
              </span>

              <h1>
                Great Deals on Your
                <br />
                Favourite Food
              </h1>

              <p>
                Enjoy special offers and discounts from
                top restaurants near you.
              </p>
            </div>
          </section>
        </Reveal>

        {/* ================= FILTERS + DEALS ================= */}
        <section className="deals-layout">
          <aside className="deals-sidebar">
            <Reveal delay={80}>
              <Filters />
            </Reveal>
          </aside>

          <div className="deals-results">
            <Reveal delay={100}>
              <header className="deals-section-heading">
                <div>
                  <h2>Today's Best Deals</h2>

                  <p>
                    Grab your favourite food at
                    special prices.
                  </p>
                </div>
              </header>
            </Reveal>

            <div className="deals-grid">
              {visibleDeals.map((deal, index) => (
                <Reveal
                  key={deal.id}
                  delay={(index % 4) * 75}
                  className="deals-card-reveal"
                >
                  <article className="deals-card">
                    {/* Deal image */}
                    <div
                      className="deals-card-image"
                      onClick={() => grabDeal(deal)}
                      style={{ cursor: "pointer" }}
                    >
                      <img
                        src={deal.image}
                        alt={deal.title}
                        loading={
                          index > 3
                            ? "lazy"
                            : "eager"
                        }
                      />

                      <span className="deals-discount">
                        {deal.badge}
                      </span>
                    </div>

                    {/* Deal information */}
                    <div className="deals-card-body">
                      <span className="deals-today">
                        🔥 TODAY'S DEAL
                      </span>

                      <h3
                        onClick={() => grabDeal(deal)}
                        style={{ cursor: "pointer" }}
                      >
                        {deal.title}
                      </h3>

                      <p className="deals-restaurant">
                        {deal.restaurant.name} · {deal.restaurant.area}
                      </p>

                      <p className="deals-description">
                        {deal.description}
                      </p>

                      <button
                        type="button"
                        className={`deals-grab-button ${
                          claimedDeals[deal.id]
                            ? "claimed"
                            : ""
                        }`}
                        onClick={() => grabDeal(deal)}
                      >
                        {claimedDeals[deal.id]
                          ? "Deal selected ✓"
                          : "Grab this deal →"}
                      </button>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>

            {!isLoading && deals.length === 0 && (
              <p className="deals-description">
                There are no deals today. Please check back later.
              </p>
            )}

            {/* ================= PAGINATION ================= */}
            <Reveal className="deals-pagination-reveal">
              <div className="deals-pagination">
                <p>
                  Showing{" "}
                  {deals.length
                    ? (safePage - 1) *
                        ITEMS_PER_PAGE +
                      1
                    : 0}
                  –
                  {Math.min(
                    safePage * ITEMS_PER_PAGE,
                    deals.length
                  )}{" "}
                  of {deals.length} deals
                </p>

                <div className="deals-pagination-controls">
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
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <Footer />
    </div>
  );
}
