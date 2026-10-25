
import { useCallback, useEffect, useState } from "react";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { ForgotPassword, ResetPassword } from "./pages/PasswordRecovery";
import Explore from "./pages/Explore";
import Cuisines from "./pages/Cuisines";
import Deals from "./pages/Deals";
import About from "./pages/About";
import Profile from "./pages/Profile";
import MyFavourites from "./pages/MyFavourites";
import MyRating from "./pages/MyRating";
import Coustomer_form from "./pages/Coustomer_form";
import RestaurantOwner_form from "./pages/RestaurantOwner_form";

import RestaurantDetails from "./pages/RestaurantDetails";
import RestaurantOwnerDashboard from "./pages/RestaurantOwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";

import { apiCall, errorMessage } from "./api";
import { toRestaurantCard } from "./restaurantMapper";
import { useSearch } from "./searchContext";

import {
  getStoredUser,
  saveUser,
  logout as clearSession,
  setSessionExpiredHandler,
} from "./api";

import "./App.css";

/* ================= HELPERS ================= */

// Unique restaurant key
function getRestaurantKey(restaurant) {
  if (!restaurant) return "";

  return String(
    restaurant.id ??
      `${restaurant.name}-${restaurant.area ?? ""}-${restaurant.type ?? ""}`
  );
}

// Profile image helper
function getProfileImage(userData) {
  return (
    userData?.photo ??
    userData?.profileImage ??
    userData?.profilePicture ??
    userData?.avatar ??
    userData?.image ??
    userData?.photoURL ??
    ""
  );
}

// Normalize rating: 0, 0.5, 1.0 ... 5.0
function normalizeRating(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.max(
    0,
    Math.min(5, Math.round(number * 2) / 2)
  );
}

// A review from /api/list_my_reviews/ -> the shape the My Reviews page reads.
// kind: "restaurant" (a review of the restaurant) or "dish" (a review of one dish).
// The id has a letter in front because a restaurant review and a dish review can share a number.
function toMyReview(kind, row, customerName) {
  const isDish = kind === "dish";

  const restaurant = {
    id: row.restaurant.id,
    name: row.restaurant.name,
    area: row.restaurant.area || "",
    city: row.restaurant.city || "",
    image: row.restaurant.image || "",
  };

  const text = row.comment || "";

  return {
    id: `${isDish ? "d" : "r"}-${row.id}`,
    reviewId: row.id,
    customerName,

    reviewType: isDish ? "food" : "restaurant",
    foodId: isDish ? row.dish.id : null,
    foodName: isDish ? row.dish.name : "",

    restaurantId: restaurant.id,
    restaurantName: isDish
      ? `${row.dish.name} (${restaurant.name})`
      : restaurant.name,
    restaurant,
    image: (isDish && row.dish.image) || restaurant.image,

    rating: row.rating,
    review: text,
    comment: text,
    text,

    date: String(row.created_at || "").slice(0, 10),
    createdAt: row.created_at,
  };
}

// Every saved restaurant of the logged-in customer, as restaurant cards.
async function fetchFavorites() {
  const cards = [];

  for (let page = 1; page <= 10; page += 1) {
    const { ok, data } = await apiCall(
      `/api/list_bookmarks/?page=${page}&page_size=100`
    );

    if (!ok) return null;

    cards.push(...data.results.map(toRestaurantCard));

    if (page >= data.total_pages) break;
  }

  return cards;
}

// Every review the logged-in customer wrote (restaurants and dishes).
async function fetchMyReviews(customerName) {
  const { ok, data } = await apiCall("/api/list_my_reviews/");

  if (!ok) return null;

  return [
    ...data.results.map((row) =>
      toMyReview("restaurant", row, customerName)
    ),
    ...data.dish_results.map((row) =>
      toMyReview("dish", row, customerName)
    ),
  ];
}

/* ================= MAIN APP ================= */

export default function App() {
  /* ================= PAGE STATE ================= */

  // A person who is still signed in (tokens in localStorage) starts on their own page.
  const [currentPage, setCurrentPage] = useState(() => {
    // The link in the password-reset email opens the new-password page.
    if (window.location.pathname === "/reset-password") {
      return "reset-password";
    }

    const savedRole = getStoredUser()?.role;

    if (savedRole === "admin") return "admin-dashboard";
    if (savedRole === "owner") return "owner-dashboard";

    return "home";
  });

  /* ================= AUTH STATE ================= */

  const [isLoggedIn, setIsLoggedIn] = useState(
    () => getStoredUser() !== null
  );
  const [user, setUser] = useState(getStoredUser);

  // The account type chosen on the login page, kept for the forgot-password page.
  const [forgotRole, setForgotRole] = useState("customer");

  /* ================= FAVOURITES ================= */

  // The customer's saved restaurants (kept in the backend).
  const [favorites, setFavorites] = useState([]);

  /* ================= SHARED REVIEWS ================= */

  // The customer's own reviews (kept in the backend).
  const [allUserReviews, setAllUserReviews] = useState([]);

  /* ================= RESTAURANT DETAILS ================= */

  const [selectedRestaurant, setSelectedRestaurant] =
    useState(null);

  const [selectedFoodId, setSelectedFoodId] =
    useState(null);

  const [selectedMenuCategory, setSelectedMenuCategory] =
    useState(null);

  // The cuisine (its slug) the Cuisines page opens on; null = the page's own first choice.
  const [selectedCuisineSlug, setSelectedCuisineSlug] =
    useState(null);

  /* ================= LOAD FAVOURITES AND REVIEWS ================= */

  const customerName = user?.name || "Customer";

  const loadFavorites = useCallback(async () => {
    const cards = await fetchFavorites();

    if (cards) setFavorites(cards);
  }, []);

  const loadMyReviews = useCallback(async () => {
    const reviews = await fetchMyReviews(customerName);

    if (reviews) setAllUserReviews(reviews);
  }, [customerName]);

  const isCustomerSignedIn =
    isLoggedIn && user?.role === "customer";

  // Fetch them when a customer signs in (or the page reloads while signed in).
  useEffect(() => {
    if (!isCustomerSignedIn) return undefined;

    let active = true;

    fetchFavorites().then((cards) => {
      if (active && cards) setFavorites(cards);
    });

    fetchMyReviews(customerName).then((reviews) => {
      if (active && reviews) setAllUserReviews(reviews);
    });

    return () => {
      active = false;
    };
  }, [isCustomerSignedIn, user?.id, customerName]);

  /* ================= SEARCH BOX ================= */

  // The search box in the top bar was used: show the results on the Explore page.
  const { text: searchText, location: searchLocation } = useSearch();

  useEffect(() => {
    const openExplore = () => {
      setCurrentPage("explore");

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    window.addEventListener("nearbite-search", openExplore);

    return () =>
      window.removeEventListener("nearbite-search", openExplore);
  }, []);

  /* ================= SESSION EXPIRED ================= */

  // The API client calls this when the refresh token no longer works.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setIsLoggedIn(false);
      setUser(null);
      setFavorites([]);
      setAllUserReviews([]);
      setCurrentPage("login");
    });

    return () => setSessionExpiredHandler(null);
  }, []);

  /* ================= ROLE HELPERS ================= */

  const isOwner =
    isLoggedIn && user?.role === "owner";

  const isAdmin =
    isLoggedIn && user?.role === "admin";

  const isCustomer =
    isLoggedIn &&
    !!user &&
    user.role !== "owner" &&
    user.role !== "admin";

  /* ================= NAVIGATION ================= */

  const goTo = (page) => {
    setCurrentPage(page);

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  };

  const goToHome = () => {
    if (isAdmin) {
      goTo("admin-dashboard");
      return;
    }

    if (isOwner) {
      goTo("owner-dashboard");
      return;
    }

    goTo("home");
  };

  const goToLogin = () => goTo("login");
  const goToSignup = () => goTo("signup");
  const goToExplore = () => goTo("explore");
  const goToCuisines = () => {
    setSelectedCuisineSlug(null);
    goTo("cuisines");
  };

  // A cuisine picked on the Home page: open the Cuisines page on that cuisine.
  const openCuisine = (slug) => {
    setSelectedCuisineSlug(slug);
    goTo("cuisines");
  };
  const openForgotPassword = (role) => {
    setForgotRole(role);
    goTo("forgot-password");
  };

  // Leaves the reset link's address so a reload does not open it again.
  const leaveResetPage = () => {
    window.history.replaceState(null, "", "/");
    goTo("login");
  };

  const goToDeals = () => goTo("deals");
  const goToAbout = () => goTo("about");

  /* ================= ACCOUNT NAVIGATION ================= */

  const goToProfile = () => {
    if (!isLoggedIn || !user) {
      goToLogin();
      return;
    }

    if (isAdmin) {
      goTo("admin-dashboard");
      return;
    }

    if (isOwner) {
      goTo("owner-dashboard");
      return;
    }

    goTo("profile");
  };

  const goToFavorites = () => {
    if (!isLoggedIn || !user) {
      goToLogin();
      return;
    }

    if (isAdmin) {
      goTo("admin-dashboard");
      return;
    }

    if (isOwner) {
      goTo("owner-dashboard");
      return;
    }

    goTo("favorites");
  };

  const goToMyRating = () => {
    if (!isLoggedIn || !user) {
      goToLogin();
      return;
    }

    if (isAdmin) {
      goTo("admin-dashboard");
      return;
    }

    if (isOwner) {
      goTo("owner-dashboard");
      return;
    }

    goTo("my-rating");
  };

  const goToOwnerDashboard = () => {
    if (!isLoggedIn || !user) {
      goToLogin();
      return;
    }

    if (isOwner) {
      goTo("owner-dashboard");
      return;
    }

    goToHome();
  };

  const goToAdminDashboard = () => {
    if (!isLoggedIn || !user) {
      goToLogin();
      return;
    }

    if (isAdmin) {
      goTo("admin-dashboard");
      return;
    }

    goToHome();
  };

  /* ================= FAVOURITES ACTIONS ================= */

  const handleToggleFavorite = async (restaurant) => {
    if (!isLoggedIn || !user) {
      window.alert("You must log in first.");
      goToLogin();
      return;
    }

    if (!isCustomer) {
      window.alert(
        "Favourites are available for customer accounts."
      );
      return;
    }

    if (!restaurant) return;

    const restaurantKey = getRestaurantKey(restaurant);

    const alreadySaved = favorites.some(
      (item) => getRestaurantKey(item) === restaurantKey
    );

    // Show the change at once; undo it if the backend says no.
    setFavorites((previousFavorites) =>
      alreadySaved
        ? previousFavorites.filter(
            (item) =>
              getRestaurantKey(item) !== restaurantKey
          )
        : [...previousFavorites, restaurant]
    );

    const { ok, data } = await apiCall(
      `/api/${
        alreadySaved
          ? "remove_bookmark"
          : "bookmark_restaurant"
      }/${restaurant.id}/`,
      { method: alreadySaved ? "DELETE" : "POST" }
    );

    if (!ok) {
      window.alert(errorMessage(data));
    }

    // Take the saved list from the backend (full restaurant cards, newest first).
    loadFavorites();
  };

  /* ================= RESTAURANT NAVIGATION ================= */

  const openRestaurantDetails = (restaurant = null) => {
    if (!restaurant) return;

    setSelectedRestaurant(restaurant);

    setSelectedFoodId(null);
    setSelectedMenuCategory(null);

    goTo("restaurant-details");
  };

  const openFoodDetails = (
    restaurant = null,
    food = null
  ) => {
    if (!restaurant) return;

    setSelectedRestaurant(restaurant);

    setSelectedFoodId(
      typeof food === "object" && food !== null
        ? food.id ?? null
        : food ?? null
    );

    setSelectedMenuCategory(null);

    goTo("restaurant-details");
  };

  const openRestaurantDeal = (
    restaurant = null,
    deal = null
  ) => {
    if (!restaurant) return;

    setSelectedRestaurant(restaurant);

    setSelectedFoodId(
      typeof deal === "object" && deal !== null
        ? deal.foodId ?? deal.id ?? null
        : deal ?? null
    );

    setSelectedMenuCategory("deals");

    goTo("restaurant-details");
  };

  /* ================= REVIEW HELPERS ================= */

  // All of my reviews, newest first (the backend gives them in that order).
  const userReviews = allUserReviews;

  /* ================= SUBMIT REVIEW ================= */

  // Saves a review of a restaurant, or of one dish when foodId is given.
  // One review per customer and restaurant / dish: sending again replaces the old one.
  // Resolves to true when it was saved.
  const handleSubmitReview = async (reviewData) => {
    if (!isLoggedIn || !user) {
      window.alert("You must log in first.");
      goToLogin();
      return false;
    }

    if (!isCustomer) {
      window.alert(
        "Only customers can submit restaurant reviews."
      );
      return false;
    }

    if (!reviewData) return false;

    const rating = normalizeRating(reviewData.rating);

    if (rating <= 0) {
      window.alert(
        "Please select a rating between 0.5 and 5."
      );
      return false;
    }

    const isDish = reviewData.foodId != null;

    const { ok, data } = await apiCall(
      isDish
        ? `/api/create_dish_review/${reviewData.foodId}/`
        : `/api/create_review/${reviewData.restaurantId}/`,
      {
        method: "POST",
        body: {
          rating,
          comment: String(reviewData.comment ?? "").trim(),
        },
      }
    );

    if (!ok) {
      window.alert(errorMessage(data));
      return false;
    }

    loadMyReviews();

    return true;
  };

  /* ================= UPDATE REVIEW ================= */

  // Changes the rating and comment of one of my reviews.
  const handleUpdateReview = (updatedReview) => {
    if (!isCustomer || !user || !updatedReview) {
      return false;
    }

    const existingReview = allUserReviews.find(
      (review) =>
        String(review.id) === String(updatedReview.id)
    );

    if (!existingReview) return false;

    const updatedText = String(
      updatedReview.review ??
        updatedReview.comment ??
        updatedReview.text ??
        existingReview.review ??
        ""
    ).trim();

    const updatedRating = normalizeRating(
      updatedReview.rating ?? existingReview.rating
    );

    if (updatedRating <= 0) {
      window.alert("Please select a valid rating.");
      return false;
    }

    // Show the change at once; the backend answer below corrects it if needed.
    setAllUserReviews((previousReviews) =>
      previousReviews.map((review) =>
        String(review.id) === String(existingReview.id)
          ? {
              ...review,
              rating: updatedRating,
              review: updatedText,
              comment: updatedText,
              text: updatedText,
            }
          : review
      )
    );

    const isDish = existingReview.foodId != null;

    apiCall(
      isDish
        ? `/api/create_dish_review/${existingReview.foodId}/`
        : `/api/create_review/${existingReview.restaurantId}/`,
      {
        method: "POST",
        body: { rating: updatedRating, comment: updatedText },
      }
    ).then(({ ok, data }) => {
      if (!ok) window.alert(errorMessage(data));

      loadMyReviews();
    });

    return true;
  };

  /* ================= DELETE REVIEW ================= */

  const handleDeleteReview = (reviewId) => {
    if (!isCustomer || !user) {
      return false;
    }

    const existingReview = allUserReviews.find(
      (review) => String(review.id) === String(reviewId)
    );

    if (!existingReview) return false;

    setAllUserReviews((previousReviews) =>
      previousReviews.filter(
        (review) =>
          String(review.id) !== String(reviewId)
      )
    );

    const isDish = existingReview.foodId != null;

    apiCall(
      isDish
        ? `/api/delete_dish_review/${existingReview.foodId}/`
        : `/api/delete_review/${existingReview.restaurantId}/`,
      { method: "DELETE" }
    ).then(({ ok, data }) => {
      if (!ok) window.alert(errorMessage(data));

      loadMyReviews();
    });

    return true;
  };

  /* ================= LOGIN ================= */

  const handleLoginSuccess = (userData) => {
    if (!userData) {
      console.error(
        "Login succeeded without user information."
      );
      return;
    }

    const profileImage =
      getProfileImage(userData);

    const normalizedRole = String(
      userData.role || "customer"
    ).toLowerCase();

    const loggedInUser = {
      ...userData,

      role: normalizedRole,

      name:
        userData.name ||
        userData.fullName ||
        userData.firstName ||
        (normalizedRole === "admin"
          ? "Admin"
          : normalizedRole === "owner"
            ? "Restaurant Owner"
            : "User"),

      photo: profileImage,
      profileImage,

      city: userData.city || "",

      area:
        userData.area ||
        userData.location ||
        "",
    };

    setUser(loggedInUser);
    setFavorites([]);
    setAllUserReviews([]);
    setIsLoggedIn(true);

    // Admin -> Admin Dashboard
    // Owner -> Owner Dashboard
    // Customer -> Home
    if (normalizedRole === "admin") {
      goTo("admin-dashboard");
    } else if (normalizedRole === "owner") {
      goTo("owner-dashboard");
    } else {
      goTo("home");
    }
  };

  /* ================= PROFILE UPDATE ================= */

  const handleProfileUpdate = (updatedData) => {
    if (!updatedData) return;

    const currentUser = user || {};

    const updatedImage =
      updatedData.photo ??
      updatedData.profileImage ??
      updatedData.profilePicture ??
      updatedData.avatar ??
      updatedData.image ??
      updatedData.photoURL ??
      getProfileImage(currentUser);

    const updatedUser = {
      ...currentUser,
      ...updatedData,

      name:
        updatedData.name ||
        updatedData.fullName ||
        currentUser.name ||
        "User",

      photo: updatedImage,
      profileImage: updatedImage,

      city:
        updatedData.city ??
        currentUser.city ??
        "",

      area:
        updatedData.area ??
        updatedData.location ??
        currentUser.area ??
        "",
    };

    setUser(updatedUser);

    // Remember it, so a reload shows the saved profile.
    saveUser(updatedUser);
  };

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    clearSession();

    setIsLoggedIn(false);
    setUser(null);
    setFavorites([]);
    setAllUserReviews([]);

    setSelectedRestaurant(null);
    setSelectedFoodId(null);
    setSelectedMenuCategory(null);

    goTo("home");
  };

  /* ================= SHARED PAGE PROPS ================= */

  const navigationProps = {
    onLoginClick: goToLogin,
    onHomeClick: goToHome,
    onExploreClick: goToExplore,
    onCuisineClick: goToCuisines,
    onCuisineSelect: openCuisine,
    onDealsClick: goToDeals,
    onAboutClick: goToAbout,

    isLoggedIn,
    user,

    onProfileClick: goToProfile,

    onLogout: handleLogout,
    onLogoutClick: handleLogout,

    // Favourites
    onFavoritesClick: goToFavorites,
    onToggleFavorite: handleToggleFavorite,
    favorites,

    // My Reviews
    onReviewsClick: goToMyRating,

    // Shared review data and actions
    allUserReviews,
    userReviews,
    onSubmitReview: handleSubmitReview,
    onUpdateReview: handleUpdateReview,
    onDeleteReview: handleDeleteReview,

    // Restaurant navigation
    onRestaurantClick: openRestaurantDetails,
    onRestaurantDetailsClick:
      openRestaurantDetails,

    onFoodClick: openFoodDetails,
    onFoodDetailsClick: openFoodDetails,

    onDealClick: openRestaurantDeal,
    onDealDetailsClick: openRestaurantDeal,

    // Owner navigation
    onOwnerDashboardClick: goToOwnerDashboard,

    // Admin navigation
    onAdminDashboardClick: goToAdminDashboard,
  };

  /* ================= REGISTRATION FORMS ================= */

  if (currentPage === "customer-form") {
    return (
      <Coustomer_form
        onBack={goToSignup}
        onLoginClick={goToLogin}
      />
    );
  }

  if (currentPage === "owner-form") {
    return (
      <RestaurantOwner_form
        onBack={goToSignup}
        onLoginClick={goToLogin}
      />
    );
  }

  /* ================= SIGNUP ================= */

  if (currentPage === "signup") {
    return (
      <Signup
        onLoginClick={goToLogin}
        onBackHome={goToHome}
        onChooseRole={(role) => {
          if (role === "customer") {
            goTo("customer-form");
          } else if (role === "owner") {
            goTo("owner-form");
          }
        }}
      />
    );
  }

  /* ================= PASSWORD RECOVERY ================= */

  if (currentPage === "forgot-password") {
    return (
      <ForgotPassword
        initialRole={forgotRole}
        onBackToLogin={goToLogin}
        onBackHome={goToHome}
      />
    );
  }

  if (currentPage === "reset-password") {
    return (
      <ResetPassword
        token={new URLSearchParams(window.location.search).get("token")}
        onBackToLogin={leaveResetPage}
        onBackHome={() => {
          window.history.replaceState(null, "", "/");
          goToHome();
        }}
      />
    );
  }

  /* ================= LOGIN ================= */

  if (currentPage === "login") {
    return (
      <Login
        onBackHome={goToHome}
        onCreateAccountClick={goToSignup}
        onLoginSuccess={handleLoginSuccess}
        onForgotPasswordClick={openForgotPassword}
      />
    );
  }

  /* ================= PROTECTED PAGES ================= */

  const customerOnlyPages = [
    "profile",
    "favorites",
    "my-rating",
  ];

  const isProtectedPage =
    customerOnlyPages.includes(currentPage) ||
    currentPage === "owner-dashboard" ||
    currentPage === "admin-dashboard";

  if (
    isProtectedPage &&
    (!isLoggedIn || !user)
  ) {
    return (
      <Login
        onBackHome={goToHome}
        onCreateAccountClick={goToSignup}
        onLoginSuccess={handleLoginSuccess}
        onForgotPasswordClick={openForgotPassword}
      />
    );
  }

  /* ================= ADMIN DASHBOARD ================= */

  if (currentPage === "admin-dashboard") {
    if (!isAdmin) {
      return <Home {...navigationProps} />;
    }

    return (
      <AdminDashboard
        user={user}
        allUserReviews={allUserReviews}
        onLogout={handleLogout}
        onLogoutClick={handleLogout}
      />
    );
  }

  /* ================= OWNER DASHBOARD ================= */

  if (currentPage === "owner-dashboard") {
    if (!isOwner) {
      return <Home {...navigationProps} />;
    }

    return (
      <RestaurantOwnerDashboard
        user={user}
        onProfileUpdate={handleProfileUpdate}
        onLogout={handleLogout}
        onLogoutClick={handleLogout}
      />
    );
  }

  /* ================= CUSTOMER PROFILE ================= */

  if (currentPage === "profile") {
    if (!isCustomer) {
      return isAdmin ? (
        <AdminDashboard
          user={user}
          allUserReviews={allUserReviews}
          onLogout={handleLogout}
          onLogoutClick={handleLogout}
        />
      ) : isOwner ? (
        <RestaurantOwnerDashboard
          user={user}
          onProfileUpdate={handleProfileUpdate}
          onLogout={handleLogout}
          onLogoutClick={handleLogout}
        />
      ) : (
        <Home {...navigationProps} />
      );
    }

    return (
      <Profile
        {...navigationProps}
        onProfileUpdate={handleProfileUpdate}
      />
    );
  }

  /* ================= MY FAVOURITES ================= */

  if (currentPage === "favorites") {
    if (!isCustomer) {
      return isAdmin ? (
        <AdminDashboard
          user={user}
          allUserReviews={allUserReviews}
          onLogout={handleLogout}
          onLogoutClick={handleLogout}
        />
      ) : isOwner ? (
        <RestaurantOwnerDashboard
          user={user}
          onProfileUpdate={handleProfileUpdate}
          onLogout={handleLogout}
          onLogoutClick={handleLogout}
        />
      ) : (
        <Home {...navigationProps} />
      );
    }

    return (
      <MyFavourites
        {...navigationProps}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  }

  /* ================= MY REVIEWS ================= */

  if (currentPage === "my-rating") {
    if (!isCustomer) {
      return isAdmin ? (
        <AdminDashboard
          user={user}
          allUserReviews={allUserReviews}
          onLogout={handleLogout}
          onLogoutClick={handleLogout}
        />
      ) : isOwner ? (
        <RestaurantOwnerDashboard
          user={user}
          onProfileUpdate={handleProfileUpdate}
          onLogout={handleLogout}
          onLogoutClick={handleLogout}
        />
      ) : (
        <Home {...navigationProps} />
      );
    }

    return (
      <MyRating
        {...navigationProps}
        userReviews={userReviews}
        onUpdateReview={handleUpdateReview}
        onDeleteReview={handleDeleteReview}
      />
    );
  }

  /* ================= RESTAURANT DETAILS ================= */

  if (currentPage === "restaurant-details") {
    return (
      <RestaurantDetails
        {...navigationProps}
        restaurant={selectedRestaurant}
        selectedFoodId={selectedFoodId}
        initialCategory={selectedMenuCategory}
        onSubmitReview={handleSubmitReview}
      />
    );
  }

  /* ================= EXPLORE ================= */

  if (currentPage === "explore") {
    // A new search starts the page afresh (page 1, no leftover filters).
    return (
      <Explore
        key={`${searchText}|${searchLocation}`}
        {...navigationProps}
      />
    );
  }

  /* ================= CUISINES ================= */

  if (currentPage === "cuisines") {
    return (
      <Cuisines
        {...navigationProps}
        initialCuisine={selectedCuisineSlug}
      />
    );
  }

  /* ================= DEALS ================= */

  if (currentPage === "deals") {
    return <Deals {...navigationProps} />;
  }

  /* ================= ABOUT ================= */

  if (currentPage === "about") {
    return <About {...navigationProps} />;
  }

  /* ================= HOME ================= */

  if (isAdmin) {
    return (
      <AdminDashboard
        user={user}
        allUserReviews={allUserReviews}
        onLogout={handleLogout}
        onLogoutClick={handleLogout}
      />
    );
  }

  if (isOwner) {
    return (
      <RestaurantOwnerDashboard
        user={user}
        onProfileUpdate={handleProfileUpdate}
        onLogout={handleLogout}
        onLogoutClick={handleLogout}
      />
    );
  }

  return <Home {...navigationProps} />;
}
