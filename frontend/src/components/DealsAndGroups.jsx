
import { useEffect, useState } from "react";

import { apiCall } from "../api";
import { toDealCard, toRestaurantCard } from "../restaurantMapper";

import Reveal from "./Reveal";

const DEAL_COUNT = 4;
const GROUP_COUNT = 6;

export default function DealsAndGroups({
  onRestaurantClick,
  onRestaurantDetailsClick,
  onDealClick,
  onDealDetailsClick,
  onDealsClick,
}) {
  // Today's deals and the top rated restaurants, from the backend.
  const [deals, setDeals] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    let active = true;

    apiCall(`/api/list_daily_deals/?limit=${DEAL_COUNT}`, {
      auth: false,
    }).then(({ ok, data }) => {
      if (active && ok) setDeals(data.map(toDealCard));
    });

    // "Top restaurants": the best rated restaurants, highest first.
    apiCall("/api/search_restaurant/?page_size=100", {
      auth: false,
    }).then(({ ok, data }) => {
      if (!active || !ok) return;

      const rating = (restaurant) =>
        Number(restaurant.rating) || 0;

      setGroups(
        data.results
          .map(toRestaurantCard)
          .sort((a, b) => rating(b) - rating(a))
          .slice(0, GROUP_COUNT)
      );
    });

    return () => {
      active = false;
    };
  }, []);

  // Open selected restaurant's Details & Menu page.
  const openRestaurant = (restaurant) => {
    if (!restaurant) {
      window.alert(
        "Restaurant details are not available for this item yet."
      );
      return;
    }

    const handleOpen =
      onRestaurantClick ||
      onRestaurantDetailsClick;

    if (handleOpen) {
      handleOpen(restaurant);
    }
  };

  // Open selected restaurant's Deals category.
  const openDeal = (deal) => {
    const restaurant = deal.restaurant;

    if (!restaurant) {
      window.alert(
        "This deal has not been linked to a restaurant yet."
      );
      return;
    }

    const handleOpen =
      onDealClick ||
      onDealDetailsClick;

    if (handleOpen) {
      // Use the exact linked menu food ID
      // for the 3-second highlight.
      const selectedDeal =
        deal.foodId != null
          ? { foodId: deal.foodId }
          : null;

      handleOpen(restaurant, selectedDeal);
    } else {
      openRestaurant(restaurant);
    }
  };

  return (
    <div className="deals-groups">
      {/* ================= DAILY DEALS ================= */}
      <section id="deals">
        <Reveal>
          <div className="title-row">
            <h2 className="section-title">
              Your daily deals
            </h2>

            <a
              href="#deals"
              className="view-all"
              onClick={(event) => {
                if (!onDealsClick) return;

                event.preventDefault();
                onDealsClick();
              }}
            >
              View all deals →
            </a>
          </div>
        </Reveal>

        <div className="deal-grid">
          {deals.map((deal, index) => (
            <Reveal
              key={`${deal.id ?? deal.title}-${index}`}
              delay={index * 90}
            >
              <div
                className="deal-card"
                role="button"
                tabIndex={0}
                aria-label={`View deal: ${deal.title}`}
                onClick={() => openDeal(deal)}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" ||
                      event.key === " ")
                  ) {
                    event.preventDefault();
                    openDeal(deal);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="deal-img">
                  <img
                    src={deal.image}
                    alt={deal.shop}
                  />

                  <span className="deal-badge">
                    {deal.badge}
                  </span>
                </div>

                <div className="deal-body">
                  <small className="today">
                    🔥 TODAY'S DEAL
                  </small>

                  <h4>{deal.title}</h4>

                  <p>{deal.shop}</p>

                  <button
                    type="button"
                    className="btn-mini"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDeal(deal);
                    }}
                  >
                    Grab this deal →
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= GROUP RESTAURANTS ================= */}
      <section style={{ marginTop: 60 }}>
        <Reveal>
          <div className="title-row">
            <h2 className="section-title">
              Top restaurants
            </h2>

            <a
              href="#restaurants"
              className="view-all"
            >
              View all →
            </a>
          </div>
        </Reveal>

        <div className="group-grid">
          {groups.map((group, index) => (
            <Reveal
              key={`${group.id ?? group.name}-${index}`}
              delay={(index % 3) * 90}
            >
              <div
                className="group-card"
                role="button"
                tabIndex={0}
                aria-label={`View ${group.name} details`}
                onClick={() =>
                  openRestaurant( group )
                }
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" ||
                      event.key === " ")
                  ) {
                    event.preventDefault();

                    openRestaurant( group );
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <img
                  src={group.image}
                  alt={group.name}
                />

                <div className="group-info">
                  <h4>{group.name}</h4>

                  <p>
                    <span className="star">
                      ★ {group.rating}
                    </span>{" "}
                    {group.area}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-mini"
                  onClick={(event) => {
                    event.stopPropagation();

                    openRestaurant( group );
                  }}
                >
                  See more →
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
