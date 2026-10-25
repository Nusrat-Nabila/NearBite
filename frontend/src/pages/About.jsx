
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";

import aboutImage from "../Image/Aboutbn.png";

import "./About.css";

const values = [
  {
    icon: "🍽️",
    title: "Our Story",
    text: "NearBite started with a simple idea: finding great food nearby should be easy, enjoyable, and convenient. We bring local restaurants and food lovers together in one place.",
  },
  {
    icon: "🎯",
    title: "Our Mission",
    text: "Our mission is to help people discover amazing local restaurants, explore different cuisines, and find delicious meals and offers that suit their taste and budget.",
  },
  {
    icon: "🔭",
    title: "Our Vision",
    text: "We envision a connected food community where every food lover can discover new favourites and every local restaurant has an opportunity to reach more customers.",
  },
];

const features = [
  {
    icon: "📍",
    title: "Discover Nearby",
    text: "Find restaurants and delicious food options around your area.",
  },
  {
    icon: "🍜",
    title: "Explore Cuisines",
    text: "Discover different cuisines, dishes, and exciting new flavours.",
  },
  {
    icon: "🏷️",
    title: "Exclusive Deals",
    text: "Explore food offers and deals to make your next meal even better.",
  },
  {
    icon: "❤️",
    title: "Made for Food Lovers",
    text: "Enjoy a simple way to explore restaurants and discover your next favourite meal.",
  },
];

export default function About({
  onLoginClick,
  onHomeClick,
  onExploreClick,
  onCuisineClick,
  onDealsClick,
  onAboutClick,

  // Shared login state from App.jsx
  isLoggedIn = false,
  user = null,

  // User dropdown navigation
  onProfileClick,
  onFavoritesClick,
  onReviewsClick,
  onLogout,
  onLogoutClick,
}) {
  return (
    <div className="about-page" id="about">
      {/* Navbar */}
      <Navbar
        onLoginClick={onLoginClick}
        onHomeClick={onHomeClick}
        onExploreClick={onExploreClick}
        onCuisineClick={onCuisineClick}
        onDealsClick={onDealsClick}
        onAboutClick={onAboutClick}

        // Logged-in user information
        isLoggedIn={isLoggedIn}
        user={user}

        // User dropdown actions
        onProfileClick={onProfileClick}
        onFavoritesClick={onFavoritesClick}
        onReviewsClick={onReviewsClick}
        onLogout={onLogout}
        onLogoutClick={onLogoutClick}
      />

      <main className="about-main">
        {/* About hero */}
        <Reveal className="about-hero-reveal">
          <section className="about-hero">
            <div className="about-hero-content">
              <span className="about-eyebrow">
                WELCOME TO NEARBITE
              </span>

              <h1>
                Good Food.
                <br />
                Great Moments.
                <br />
                <span>Right Near You.</span>
              </h1>

              <p>
                Discover local flavours, explore amazing
                restaurants, and make every meal memorable
                with NearBite.
              </p>

              <button
                type="button"
                className="about-primary-button"
                onClick={onExploreClick}
              >
                Explore Restaurants <span>→</span>
              </button>
            </div>

            <div className="about-hero-image">
              <img
                src={aboutImage}
                alt="NearBite food and restaurant experience"
              />
            </div>
          </section>
        </Reveal>

        {/* Intro */}
        <Reveal delay={100}>
          <section className="about-intro">
            <span className="about-eyebrow">
              WHO WE ARE
            </span>

            <h2>
              Bringing People Together
              <br />
              <span>Through Food</span>
            </h2>

            <p>
              NearBite is a food discovery platform designed to
              make finding your next meal easier. Whether you
              are craving familiar comfort food or looking to
              try something new, we help you explore restaurants,
              cuisines, and food deals in one convenient place.
            </p>
          </section>
        </Reveal>

        {/* Story, mission and vision */}
        <section className="about-values">
          {values.map((item, index) => (
            <Reveal
              key={item.title}
              delay={index * 100}
              className="about-value-reveal"
            >
              <article className="about-value-card">
                <div className="about-value-icon">
                  {item.icon}
                </div>

                <h3>{item.title}</h3>

                <p>{item.text}</p>
              </article>
            </Reveal>
          ))}
        </section>

        {/* Why choose NearBite */}
        <Reveal>
          <section className="about-why">
            <div className="about-section-heading">
              <span className="about-eyebrow">
                THE NEARBITE EXPERIENCE
              </span>

              <h2>
                Why Choose <span>NearBite?</span>
              </h2>

              <p>
                Everything you need to make discovering your
                next favourite meal simpler.
              </p>
            </div>

            <div className="about-feature-grid">
              {features.map((feature, index) => (
                <Reveal
                  key={feature.title}
                  delay={index * 80}
                  className="about-feature-reveal"
                >
                  <article className="about-feature-card">
                    <span className="about-feature-icon">
                      {feature.icon}
                    </span>

                    <h3>{feature.title}</h3>

                    <p>{feature.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Call to action */}
        <Reveal>
          <section className="about-cta">
            <div>
              <span className="about-eyebrow">
                YOUR NEXT FAVOURITE MEAL AWAITS
              </span>

              <h2>
                Let’s Discover Something Delicious.
              </h2>

              <p>
                Explore restaurants, discover cuisines, and
                find your next food favourite with NearBite.
              </p>
            </div>

            <div className="about-cta-actions">
              <button
                type="button"
                className="about-primary-button"
                onClick={onExploreClick}
              >
                Explore Now <span>→</span>
              </button>

              <button
                type="button"
                className="about-secondary-button"
                onClick={onCuisineClick}
              >
                Browse Cuisines
              </button>
            </div>
          </section>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
