
import { useEffect, useRef, useState } from "react";

import { img, locations } from "../data/data";
import locationOptions from "../data/locationOptions";

// Default profile picture
import defaultProfileImage from "../Image/profile.png";

import { useSearch } from "../searchContext";
import { locateByGps } from "../nearMe";

import "./Navbar.css";

export default function Navbar({
  onLoginClick,
  onExploreClick,
  onHomeClick,
  onCuisineClick,
  onDealsClick,
  onAboutClick,

  // Login state and user information
  isLoggedIn = false,
  user = null,

  // User menu navigation
  onProfileClick,
  onFavoritesClick,
  onReviewsClick,
  onLogout,
  onLogoutClick,
}) {
  const [locationOpen, setLocationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // The words last searched for (kept while moving between pages) and the area chosen by hand.
  const {
    text: lastSearch,
    location: chosenLocation,
    near,
    run: runSearch,
    setLocation,
    setNear,
  } = useSearch();

  const [locating, setLocating] = useState(false);

  const [searchText, setSearchText] = useState(lastSearch);

  // Profile image loading state
  const [imageError, setImageError] = useState(false);

  const headerRef = useRef(null);

  // User profile information
  const userName =
    user?.name ||
    user?.fullName ||
    user?.firstName ||
    "User";

  // Profile.jsx stores uploaded images in "photo".
  // App.jsx also stores profileImage.
  // Empty photo means the user removed their picture.
  const userImage =
    user?.photo ??
    user?.profileImage ??
    user?.profilePicture ??
    user?.avatar ??
    user?.image ??
    user?.photoURL ??
    "";

  const userCity = user?.city || "";
  const userArea = user?.area || user?.location || "";

  // Use uploaded image when available.
  // Otherwise use Image/profile.png.
  const displayProfileImage =
    userImage && !imageError
      ? userImage
      : defaultProfileImage;

  const [selectedLocation, setSelectedLocation] = useState(
    chosenLocation || userArea || "Your Location"
  );

  // Reset image error whenever profile image changes.
  useEffect(() => {
    setImageError(false);
  }, [userImage]);

  // Update selected location when profile data changes.
  useEffect(() => {
    if (near) {
      setSelectedLocation(near.short || "Near me");
    } else if (chosenLocation) {
      setSelectedLocation(chosenLocation);
    } else if (isLoggedIn && userArea) {
      setSelectedLocation(userArea);
    } else if (!isLoggedIn) {
      setSelectedLocation("Your Location");
    }
  }, [isLoggedIn, userArea, chosenLocation, near]);

  // Get areas belonging to the user's city.
  const cityAreas = (() => {
    if (!userCity || !locationOptions) return [];

    if (Array.isArray(locationOptions)) {
      const city = locationOptions.find(
        (item) =>
          item.city?.toLowerCase() ===
          userCity.toLowerCase()
      );

      return city?.areas || [];
    }

    const cityKey = Object.keys(locationOptions).find(
      (key) =>
        key.toLowerCase() === userCity.toLowerCase()
    );

    if (!cityKey) return [];

    const areas = locationOptions[cityKey];

    return Array.isArray(areas)
      ? areas
      : areas?.areas || [];
  })();

  const availableLocations =
    isLoggedIn && cityAreas.length > 0
      ? cityAreas
      : locations;

  // Scroll effect and outside-click handling.
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    const handleOutsideClick = (event) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target)
      ) {
        setLocationOpen(false);
        setUserMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setLocationOpen(false);
        setUserMenuOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    handleScroll();

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );

      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  // Navigate between pages.
  const handleNavigation = (event, callback, page) => {
    event.preventDefault();

    setLocationOpen(false);
    setUserMenuOpen(false);

    if (typeof callback === "function") {
      callback();
    } else {
      console.warn(
        `${page} navigation callback is missing.`
      );
    }
  };

  // Location selection.
  const handleLocationSelect = (area) => {
    setSelectedLocation(area);
    setLocationOpen(false);

    // Searches are limited to the area chosen here (and no longer to a GPS position).
    setNear(null);
    setLocation(area);
  };

  // "Use my current location": ask the browser, then show the nearest restaurants on Explore.
  const handleUseMyLocation = async () => {
    setLocating(true);

    try {
      const position = await locateByGps();

      setNear(position);
      setLocationOpen(false);

      // An empty area: the position decides, not an area name.
      runSearch(searchText.trim(), "");
    } catch (error) {
      window.alert(error.message);
    } finally {
      setLocating(false);
    }
  };

  // Search: open the Explore page with the words typed (and the chosen area).
  const submitSearch = () => {
    runSearch(searchText.trim(), chosenLocation);
  };

  // Logout.
  const handleLogout = () => {
    setUserMenuOpen(false);

    const logoutCallback =
      typeof onLogoutClick === "function"
        ? onLogoutClick
        : onLogout;

    if (typeof logoutCallback === "function") {
      logoutCallback();
    } else {
      console.warn("Logout callback is missing.");
    }
  };

  // User dropdown actions.
  const handleUserMenuAction = (callback, label) => {
    setUserMenuOpen(false);

    if (typeof callback === "function") {
      callback();
    } else {
      console.warn(
        `${label} callback is missing.`
      );
    }
  };

  return (
    <header
      ref={headerRef}
      className={`navbar ${
        scrolled ? "navbar-scrolled" : ""
      }`}
    >
      <div className="nav-top">
        {/* Logo */}
        <a
          href="#home"
          className="nav-logo"
          onClick={(event) =>
            handleNavigation(
              event,
              onHomeClick,
              "Home"
            )
          }
        >
          <img
            src={img.logo}
            alt="NearBite logo"
          />

          <span className="nav-brand-name">
            Near
            <span className="nav-brand-bite">
              Bite
            </span>
          </span>
        </a>

        {/* Main navigation */}
        <nav
          className="nav-links"
          aria-label="Main navigation"
        >
          <a
            href="#home"
            onClick={(event) =>
              handleNavigation(
                event,
                onHomeClick,
                "Home"
              )
            }
          >
            Home
          </a>

          <a
            href="#explore"
            onClick={(event) =>
              handleNavigation(
                event,
                onExploreClick,
                "Explore"
              )
            }
          >
            Explore
          </a>

          <a
            href="#cuisines"
            onClick={(event) =>
              handleNavigation(
                event,
                onCuisineClick,
                "Cuisines"
              )
            }
          >
            Cuisines
          </a>

          <a
            href="#deals"
            onClick={(event) =>
              handleNavigation(
                event,
                onDealsClick,
                "Deals"
              )
            }
          >
            Deals
          </a>

          <a
            href="#about"
            onClick={(event) =>
              handleNavigation(
                event,
                onAboutClick,
                "About Us"
              )
            }
          >
            About Us
          </a>
        </nav>

        {/* Login button or logged-in user menu */}
        <div className="nav-actions">
          {isLoggedIn && user ? (
            <div className="nav-user-wrap">
              <button
                type="button"
                className="nav-user-button"
                onClick={() => {
                  setUserMenuOpen(
                    (previous) => !previous
                  );
                  setLocationOpen(false);
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="Open user menu"
              >
                {/* User profile picture */}
                <img
                  key={displayProfileImage}
                  className="nav-user-avatar"
                  src={displayProfileImage}
                  alt={`${userName}'s profile`}
                  onError={() => {
                    if (
                      displayProfileImage !==
                      defaultProfileImage
                    ) {
                      setImageError(true);
                    }
                  }}
                />

                {/* Username */}
                <span className="nav-user-name">
                  {userName}
                </span>

                {/* Dropdown arrow */}
                <span
                  className={`chev ${
                    userMenuOpen ? "chev-open" : ""
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {/* User dropdown */}
              <div
                className={`user-dropdown ${
                  userMenuOpen
                    ? "user-dropdown-open"
                    : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    handleUserMenuAction(
                      onProfileClick,
                      "Profile"
                    )
                  }
                >
                  My Profile
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUserMenuAction(
                      onFavoritesClick,
                      "Favourites"
                    )
                  }
                >
                  My Favourites
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUserMenuAction(
                      onReviewsClick,
                      "Reviews"
                    )
                  }
                >
                  My Reviews
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={onLoginClick}
            >
              Log In or Sign up
            </button>
          )}
        </div>
      </div>

      {/* Location selector and search */}
      <div className="nav-search">
        <div className="loc-wrap">
          <button
            type="button"
            className="loc-btn"
            onClick={() => {
              setLocationOpen(
                (previous) => !previous
              );
              setUserMenuOpen(false);
            }}
            aria-expanded={locationOpen}
            aria-label="Choose location"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="#d63a2f"
              aria-hidden="true"
            >
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>

            <span>
              {selectedLocation}
            </span>

            <svg
              className={`chev ${
                locationOpen ? "chev-open" : ""
              }`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {/* Location dropdown */}
          <ul
            className={`loc-menu ${
              locationOpen
                ? "loc-menu-open"
                : ""
            }`}
          >
            <li>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
              >
                📍{" "}
                {locating
                  ? "Finding you..."
                  : "Use my current location"}
              </button>
            </li>

            {availableLocations.map((item) => {
              const areaName =
                typeof item === "string"
                  ? item
                  : item.name;

              if (!areaName) return null;

              return (
                <li key={areaName}>
                  <button
                    type="button"
                    onClick={() =>
                      handleLocationSelect(
                        areaName
                      )
                    }
                  >
                    {areaName}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Search input */}
        <input
          type="text"
          value={searchText}
          onChange={(event) =>
            setSearchText(
              event.target.value
            )
          }
          placeholder="Search for restaurant, dish or cuisines .."
          aria-label="Search restaurants, dishes or cuisines"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitSearch();
            }
          }}
        />

        {/* Search button */}
        <button
          type="button"
          className="search-btn"
          aria-label="Search"
          onClick={submitSearch}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
            />
            <path d="m20 20-4-4" />
          </svg>
        </button>
      </div>
    </header>
  );
}
