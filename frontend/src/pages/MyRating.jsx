
import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import "./MyRating.css";

function normalizeRating(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.min(5, Math.round(number * 2) / 2));
}

function StarRating({
  rating = 0,
  interactive = false,
  onChange,
}) {
  const safeRating = normalizeRating(rating);

  const handleStarClick = (event, starNumber) => {
    if (!interactive || typeof onChange !== "function") {
      return;
    }

    const bounds =
      event.currentTarget.getBoundingClientRect();

    const clickPosition = event.clientX - bounds.left;

    const isHalf = clickPosition < bounds.width / 2;

    const newRating = starNumber - (isHalf ? 0.5 : 0);

    onChange(
      safeRating === newRating ? 0 : newRating
    );
  };

  return (
    <div
      className={`my-rating-stars ${
        interactive ? "my-rating-stars-editable" : ""
      }`}
      aria-label={`${safeRating.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const starNumber = index + 1;

        const fillPercentage = Math.max(
          0,
          Math.min(100, (safeRating - index) * 100)
        );

        return (
          <button
            key={starNumber}
            type="button"
            className="my-rating-star"
            disabled={!interactive}
            onClick={(event) =>
              handleStarClick(event, starNumber)
            }
            aria-label={
              interactive
                ? `Choose ${starNumber - 0.5} or ${starNumber} stars`
                : `${starNumber} star`
            }
            tabIndex={interactive ? 0 : -1}
          >
            <span
              className="my-rating-star-empty"
              aria-hidden="true"
            >
              ★
            </span>

            <span
              className="my-rating-star-filled"
              aria-hidden="true"
              style={{
                width: `${fillPercentage}%`,
              }}
            >
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function MyRating({
  onLoginClick,
  onHomeClick,
  onExploreClick,
  onCuisineClick,
  onDealsClick,
  onAboutClick,
  onProfileClick,
  onFavoritesClick,
  onReviewsClick,
  onSettingsClick,
  onLogout,
  onLogoutClick,

  onRestaurantClick,
  onRestaurantDetailsClick,

  // Optional shared review state from App.jsx
  userReviews,
  onUpdateReview,
  onDeleteReview,

  user,
  isLoggedIn = false,
}) {
  // Only used when no reviews are passed in (App.jsx always passes the backend ones).
  const [localReviews, setLocalReviews] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editRating, setEditRating] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const usingSharedReviews = Array.isArray(userReviews);

  const reviews = usingSharedReviews
    ? userReviews
    : localReviews;

  useEffect(() => {
    setEditingId(null);
    setEditText("");
    setEditRating(0);
    setError("");
    setSuccess("");
  }, [user?.id]);

  const getReviewText = (review) =>
    review.review ?? review.comment ?? "";

  const getReviewName = (review) =>
    review.restaurantName ??
    review.restaurant?.name ??
    "Restaurant";

  const getReviewImage = (review) => {
    if (review.image) return review.image;

    if (review.restaurant?.image) {
      return review.restaurant.image;
    }

    return "";
  };

  const openRestaurant = (review) => {
    const restaurant =
      review.restaurant;

    if (!restaurant) return;

    const handleOpen =
      onRestaurantClick || onRestaurantDetailsClick;

    handleOpen?.(restaurant);
  };

  const handleEdit = (review) => {
    setEditingId(review.id);
    setEditText(getReviewText(review));
    setEditRating(normalizeRating(review.rating));

    setError("");
    setSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditRating(0);
    setError("");
  };

  const handleSaveEdit = (event, reviewId) => {
    event.preventDefault();

    if (!editText.trim()) {
      setError(
        "Please enter your review before saving."
      );
      return;
    }

    if (
      !Number.isFinite(editRating) ||
      editRating < 0 ||
      editRating > 5 ||
      !Number.isInteger(editRating * 2)
    ) {
      setError(
        "Please select a rating between 0 and 5."
      );
      return;
    }

    const updatedReview = reviews.find(
      (review) => review.id === reviewId
    );

    if (!updatedReview) {
      setError("Review not found.");
      return;
    }

    const changes = {
      ...updatedReview,
      rating: editRating,
      review: editText.trim(),
      comment: editText.trim(),
    };

    if (usingSharedReviews) {
      if (typeof onUpdateReview !== "function") {
        setError(
          "Review updates are not connected yet."
        );
        return;
      }

      onUpdateReview(changes);
    } else {
      setLocalReviews((previousReviews) =>
        previousReviews.map((review) =>
          review.id === reviewId
            ? changes
            : review
        )
      );
    }

    setEditingId(null);
    setEditText("");
    setEditRating(0);

    setError("");
    setSuccess(
      "Your review has been updated successfully."
    );
  };

  const handleDelete = (reviewId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this review?"
    );

    if (!confirmed) return;

    if (usingSharedReviews) {
      if (typeof onDeleteReview !== "function") {
        setError(
          "Review deletion is not connected yet."
        );
        return;
      }

      onDeleteReview(reviewId);
    } else {
      setLocalReviews((previousReviews) =>
        previousReviews.filter(
          (review) => review.id !== reviewId
        )
      );
    }

    if (editingId === reviewId) {
      handleCancelEdit();
    }

    setError("");
    setSuccess("Your review has been deleted.");
  };

  const navbarProps = {
    onLoginClick,
    onHomeClick,
    onExploreClick,
    onCuisineClick,
    onDealsClick,
    onAboutClick,
    onProfileClick,
    onFavoritesClick,
    onReviewsClick,
    onSettingsClick,
    onLogout,
    onLogoutClick,
    user,
    isLoggedIn,
  };

  return (
    <div className="my-rating-page">
      <Navbar {...navbarProps} />

      <main className="my-rating-main">
        <div className="my-rating-container">
          {/* Page heading */}
          <header className="my-rating-heading">
            <span className="my-rating-eyebrow">
              YOUR ACCOUNT
            </span>

            <h1>My Review</h1>

            <p>
              Your reviews and ratings help others find
              great food.
            </p>
          </header>

          {/* Error message */}
          {error && (
            <p
              className="my-rating-message my-rating-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Success message */}
          {success && (
            <p
              className="my-rating-message my-rating-success"
              role="status"
            >
              {success}
            </p>
          )}

          {reviews.length > 0 ? (
            <section
              className="my-rating-list"
              aria-label="Your restaurant reviews"
            >
              {reviews.map((review) => {
                const isEditing =
                  editingId === review.id;

                const rating = normalizeRating(
                  review.rating
                );

                const restaurant =
                  review.restaurant;

                return (
                  <article
                    className={`my-rating-card ${
                      isEditing ? "is-editing" : ""
                    }`}
                    key={review.id}
                  >
                    {/* Restaurant image */}
                    <img
                      className="my-rating-restaurant-image"
                      src={getReviewImage(review)}
                      alt={getReviewName(review)}
                      onClick={() =>
                        openRestaurant(review)
                      }
                      style={{
                        cursor: restaurant
                          ? "pointer"
                          : "default",
                      }}
                    />

                    <div className="my-rating-content">
                      {/* Restaurant name and rating */}
                      <div className="my-rating-card-heading">
                        <h2
                          onClick={() =>
                            openRestaurant(review)
                          }
                          style={{
                            cursor: restaurant
                              ? "pointer"
                              : "default",
                          }}
                        >
                          {getReviewName(review)}
                        </h2>

                        {!isEditing && (
                          <div className="my-rating-score">
                            <StarRating rating={rating} />

                            <span className="my-rating-value">
                              {rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <form
                          className="my-rating-edit-form"
                          onSubmit={(event) =>
                            handleSaveEdit(
                              event,
                              review.id
                            )
                          }
                        >
                          {/* Edit review text */}
                          <label
                            className="my-rating-edit-label"
                            htmlFor={`review-text-${review.id}`}
                          >
                            Edit your review
                          </label>

                          <textarea
                            id={`review-text-${review.id}`}
                            value={editText}
                            onChange={(event) => {
                              setEditText(
                                event.target.value
                              );
                              setError("");
                              setSuccess("");
                            }}
                            rows={4}
                            maxLength={1000}
                            placeholder="Write your experience..."
                            required
                          />

                          {/* Half-star rating editor */}
                          <div className="my-rating-edit-rating">
                            <span>Your rating</span>

                            <StarRating
                              rating={editRating}
                              interactive
                              onChange={(value) => {
                                setEditRating(value);
                                setError("");
                                setSuccess("");
                              }}
                            />

                            <strong
                              style={{
                                color: "#9C1900",
                              }}
                            >
                              {editRating.toFixed(1)} / 5
                            </strong>
                          </div>

                          {/* Save and Cancel */}
                          <div className="my-rating-actions">
                            <button
                              type="button"
                              className="my-rating-cancel"
                              onClick={
                                handleCancelEdit
                              }
                            >
                              Cancel
                            </button>

                            <button
                              type="submit"
                              className="my-rating-save"
                            >
                              Save Review
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {/* Review text */}
                          <p className="my-rating-review-text">
                            {getReviewText(review)}
                          </p>

                          {/* Edit and Delete */}
                          <div className="my-rating-actions">
                            <button
                              type="button"
                              className="my-rating-edit-button"
                              onClick={() =>
                                handleEdit(review)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="my-rating-delete-button"
                              onClick={() =>
                                handleDelete(
                                  review.id
                                )
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            /* Empty reviews */
            <section className="my-rating-empty">
              <div
                className="my-rating-empty-icon"
                aria-hidden="true"
              >
                ★
              </div>

              <h2>No reviews yet</h2>

              <p>
                Your restaurant reviews will appear here
                after you share your experience.
              </p>

              <button
                type="button"
                className="my-rating-empty-button"
                onClick={
                  onExploreClick || onHomeClick
                }
              >
                Explore Restaurants
              </button>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
