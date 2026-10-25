
import { useEffect, useState } from "react";

import { apiCall } from "../api";
import { toRestaurantCard } from "../restaurantMapper";
import Reveal from "./Reveal";

const HOME_RESTAURANT_COUNT = 12;

const getRestaurantKey = (restaurant) =>
  String(
    restaurant.id ??
      `${restaurant.name}-${restaurant.area ?? ""}-${restaurant.type ?? ""}`
  );

export default function Restaurants({
  favorites = [],
  onToggleFavorite,
  onRestaurantClick,
  onRestaurantDetailsClick,
}) {
  // The first restaurants (A to Z) with today's best offer of each, from the backend.
  const [list, setList] = useState([]);

  useEffect(() => {
    let active = true;

    Promise.all([
      apiCall(
        `/api/search_restaurant/?page_size=${HOME_RESTAURANT_COUNT}`,
        { auth: false }
      ),
      apiCall("/api/list_daily_deals/?limit=50", {
        auth: false,
      }),
    ]).then(([restaurantsResult, dealsResult]) => {
      if (!active || !restaurantsResult.ok) return;

      // Each restaurant appears at most once in the deals list: its best offer.
      const dealByRestaurant = new Map(
        (dealsResult.ok ? dealsResult.data : []).map((deal) => [
          deal.restaurant.id,
          deal,
        ])
      );

      setList(
        restaurantsResult.data.results.map((item) => {
          const card = toRestaurantCard(item);
          const deal = dealByRestaurant.get(item.id);

          return deal
            ? {
                ...card,
                off:
                  deal.discount_percentage != null
                    ? `${deal.discount_percentage}%`
                    : null,
                offer: deal.deal_title,
              }
            : card;
        })
      );
    });

    return () => {
      active = false;
    };
  }, []);

  const openRestaurant = (restaurant) => {
    const handleOpen =
      onRestaurantClick || onRestaurantDetailsClick;

    handleOpen?.(restaurant);
  };

  return (
    <section className="section" id="restaurants">
      <Reveal>
        <div className="title-row">
          <h2 className="section-title">All restaurants</h2>

          <a href="#restaurants" className="view-all">
            View all →
          </a>
        </div>
      </Reveal>

      <div className="rest-grid">
        {list.map((restaurant, index) => {
          const isFavorite = favorites.some(
            (item) =>
              getRestaurantKey(item) ===
              getRestaurantKey(restaurant)
          );

          return (
            <Reveal
              key={`${getRestaurantKey(restaurant)}-${index}`}
              delay={(index % 4) * 80}
            >
              <div
                className="rest-card"
                role="button"
                tabIndex={0}
                aria-label={`View ${restaurant.name} menu`}
                onClick={() => openRestaurant(restaurant)}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" ||
                      event.key === " ")
                  ) {
                    event.preventDefault();
                    openRestaurant(restaurant);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="rest-img">
                  <img
                    src={restaurant.image}
                    alt={restaurant.name}
                    loading="lazy"
                  />

                  {restaurant.off && (
                    <span className="deal-badge">
                      {restaurant.off} OFF
                    </span>
                  )}

                  <button
                    type="button"
                    className={`heart ${
                      isFavorite ? "heart-on" : ""
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite?.(restaurant);
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
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill={
                        isFavorite
                          ? "currentColor"
                          : "none"
                      }
                      stroke="currentColor"
                      strokeWidth="2.4"
                      aria-hidden="true"
                    >
                      <path d="M12 21s-8-5.4-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.6-8 11-8 11Z" />
                    </svg>
                  </button>

                  {restaurant.isOpenNow === true && (
                    <span className="open-tag">
                      ● Open now
                    </span>
                  )}
                </div>

                <div className="rest-body">
                  <div className="rest-top">
                    <h4>{restaurant.name}</h4>

                    <span className="star">
                      ★ {restaurant.rating}
                    </span>
                  </div>

                  <small className="muted">
                    {restaurant.type} · {restaurant.area}
                  </small>

                  {restaurant.dish && (
                    <p className="dish">
                      {restaurant.dish}
                    </p>
                  )}

                  {restaurant.price != null && (
                    <div className="price-line">
                      <div>
                        <b>৳{restaurant.price}</b>{" "}

                        {restaurant.old != null && (
                          <s>৳{restaurant.old}</s>
                        )}
                      </div>
                    </div>
                  )}

                  {restaurant.offer && (
                    <div className="offer-pill">
                      {restaurant.offer}
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
