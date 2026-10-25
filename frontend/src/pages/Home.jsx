
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Cuisines from "../components/Cuisines";
import Filters from "../components/Filters";
import DealsAndGroups from "../components/DealsAndGroups";
import Restaurants from "../components/Restaurants";
import Footer from "../components/Footer";

export default function Home({
  // Main navigation
  onLoginClick,
  onHomeClick,
  onExploreClick,
  onCuisineClick,
  onCuisineSelect,
  onDealsClick,
  onAboutClick,

  // User navigation
  onProfileClick,
  onFavoritesClick,
  onReviewsClick,
  onSettingsClick,
  onLogout,
  onLogoutClick,

  // Login state
  user,
  isLoggedIn = false,

  // Shared favourites
  favorites = [],
  onToggleFavorite,

  // NEW: Restaurant Details navigation
  onRestaurantClick,
  onRestaurantDetailsClick,
  onFoodClick,
  onFoodDetailsClick,
  onDealClick,
  onDealDetailsClick,
}) {
  return (
    <>
      {/* Navbar */}
      <Navbar
        onLoginClick={onLoginClick}
        onHomeClick={onHomeClick}
        onExploreClick={onExploreClick}
        onCuisineClick={onCuisineClick}
        onDealsClick={onDealsClick}
        onAboutClick={onAboutClick}
        onProfileClick={onProfileClick}
        onFavoritesClick={onFavoritesClick}
        onReviewsClick={onReviewsClick}
        onSettingsClick={onSettingsClick}
        onLogout={onLogout}
        onLogoutClick={onLogoutClick}
        user={user}
        isLoggedIn={isLoggedIn}
      />

      <main className="container">
        {/* Hero */}
        <Hero
          user={user}
          isLoggedIn={isLoggedIn}
          onExploreClick={onExploreClick}
        />

        {/* Home cuisine categories */}
        <Cuisines
          onCuisineSelect={onCuisineSelect}
          onCuisineClick={onCuisineClick}
          onFoodClick={onFoodClick}
          onFoodDetailsClick={onFoodDetailsClick}
        />

        {/* Filters and deals */}
        <div className="with-filters">
          <Filters onSeeMore={onCuisineClick} />

          <DealsAndGroups
            user={user}
            isLoggedIn={isLoggedIn}
            onLoginClick={onLoginClick}
            onDealsClick={onDealsClick}
            onRestaurantClick={onRestaurantClick}
            onRestaurantDetailsClick={
              onRestaurantDetailsClick
            }
            onFoodClick={onFoodClick}
            onFoodDetailsClick={onFoodDetailsClick}
            onDealClick={onDealClick}
            onDealDetailsClick={onDealDetailsClick}
          />
        </div>

        {/* Restaurant cards */}
        <Restaurants
          user={user}
          isLoggedIn={isLoggedIn}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onLoginClick={onLoginClick}
          onRestaurantClick={onRestaurantClick}
          onRestaurantDetailsClick={
            onRestaurantDetailsClick
          }
          onFoodClick={onFoodClick}
          onFoodDetailsClick={onFoodDetailsClick}
          onDealClick={onDealClick}
          onDealDetailsClick={onDealDetailsClick}
        />
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
