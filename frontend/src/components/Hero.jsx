
import { img } from "../data/data";

export default function Hero({ isLoggedIn = false, user = null, onExploreClick }) {
  const userName =
    user?.name ||
    user?.fullName ||
    user?.firstName ||
    "User";

  return (
    <section
      className="hero"
      id="home"
      style={{ backgroundImage: `url(${img.banner})` }}
    >
      <div className="hero-overlay" />

      <div className="hero-content">
        {isLoggedIn ? (
          <>
            <h1>
              Welcome Back
              <br />
              <span>{userName}!</span>
            </h1>

            <p>
              Ready for your next meal? Explore nearby
              top-rated restaurants and order your favourites.
            </p>

            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={onExploreClick}
            >
              Explore Restaurants →
            </button>
          </>
        ) : (
          <>
            <h1>
              Find food you'll love,
              <br />
              <span>near you.</span>
            </h1>

            <p>
              Discover the best restaurants, explore menus,
              filter by your dietary needs, and find what's open now.
            </p>

            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={onExploreClick}
            >
              Check out all the Restaurants
            </button>
          </>
        )}
      </div>
    </section>
  );
}
