  import { useCallback, useEffect, useState } from "react";
  import {
    LayoutDashboard,
    UserRound,
    Store,
    UtensilsCrossed,
    MessageSquareText,
    LogOut,
    Camera,
    Pencil,
    Plus,
    Star,
    Menu,
    X,
    Mail,
    Phone,
    MapPin,
    LockKeyhole,
    Eye,
    EyeOff,
    Save,
    IdCard,
    Image as ImageIcon,
    Search,
    Tag,
    Trash2,
    Navigation,
  } from "lucide-react";

  import { apiCall, errorMessage, fetchAllPages, mapBackendUser } from "../api";
  import OwnerOffers from "./OwnerOffers";

  import logoImage from "../Image/logo.png";
  import defaultProfileImage from "../Image/profile.png";
  import "./RestaurantOwnerDashboard.css";

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "My Profile", icon: UserRound },
    { id: "restaurant", label: "Restaurant Info", icon: Store },
    { id: "menu", label: "Manage Menu", icon: UtensilsCrossed },
    { id: "offers", label: "Offers", icon: Tag },
    { id: "reviews", label: "Reviews", icon: MessageSquareText },
  ];

  const EMPTY_FOOD = {
    name: "",
    category: "",
    price: "",
    oldPrice: "",
    description: "",
    image: "",
    available: true,
    cuisines: [],
    dietaryTags: [],
    foodCategories: [],
  };

  // The meals and occasions an owner can choose (the values the backend accepts).
  const MEAL_CHOICES = [
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "snacks", label: "Snacks" },
    { value: "dinner", label: "Dinner" },
  ];

  const OCCASION_CHOICES = [
    { value: "family", label: "Family" },
    { value: "couples", label: "Couples" },
    { value: "friends", label: "Friends / Large Groups" },
    { value: "solo", label: "Solo" },
  ];

  // ================= LOADING FROM THE BACKEND =================

  // How many pages of reviews to read (10 reviews a page).
  const MAX_REVIEW_PAGES = 5;

  // ================= HELPERS =================

  function getProfileImage(user) {
    return (
      user?.photo ||
      user?.profileImage ||
      user?.profilePicture ||
      user?.avatar ||
      user?.image ||
      user?.photoURL ||
      ""
    );
  }

  // "10:30:00" -> "10:30" (what a time input wants)
  function toTimeInput(value) {
    return value ? String(value).slice(0, 5) : "";
  }

  // The owner's own details, from the signed-in user (login data) ...
  function createInitialProfile(user) {
    return {
      ownerName: user?.ownerName || "",
      restaurantName: user?.restaurantName || user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      city: user?.city || "",
      area: user?.area || "",
      address: user?.address || "",
      businessRegistration: user?.businessId || "",
      profileImage: getProfileImage(user),
    };
  }

  // ... and the restaurant's, before the backend answers.
  function createInitialRestaurant(user) {
    return {
      id: String(user?.restaurantId ?? ""),
      name: user?.restaurantName || user?.name || "",
      cuisineType: "",
      minPrice: "",
      maxPrice: "",
      description: user?.description || "",
      address: user?.address || "",
      image: user?.coverImage || "",
    };
  }

  // A picture chosen just now is a data: URL: send it as a file.
  async function dataUrlToFile(dataUrl, name) {
    const blob = await (await fetch(dataUrl)).blob();
    const extension = blob.type.split("/")[1] || "png";

    return { blob, filename: `${name}.${extension}` };
  }

  // Every review of a restaurant (or of its dishes), newest first. null when it could not be loaded.
  async function fetchReviewPages(path) {
    const rows = [];
    let count = 0;

    for (let page = 1; page <= MAX_REVIEW_PAGES; page += 1) {
      const { ok, data } = await apiCall(`${path}?page=${page}`, {
        auth: false,
      });

      if (!ok) return null;

      rows.push(...data.results);
      count = data.count;

      if (page >= data.total_pages) break;
    }

    return { rows, count };
  }

  // Everything the dashboard shows, from the backend.
  async function loadOwnerData(restaurantId) {
    const [
      profileResult,
      menuRows,
      categoryResult,
      restaurantReviews,
      dishReviews,
      cuisineResult,
      dietaryResult,
    ] = await Promise.all([
      apiCall(`/api/view_restaurant_profile/${restaurantId}/`, {
        auth: false,
      }),
      fetchAllPages("/api/list_menu_item/"),
      apiCall("/api/list_menu_category/"),
      fetchReviewPages(`/api/list_reviews/${restaurantId}/`),
      fetchReviewPages(
        `/api/list_restaurant_dish_reviews/${restaurantId}/`
      ),
      apiCall("/api/list_cuisine_options/", { auth: false }),
      apiCall("/api/list_dietary_tag_options/", { auth: false }),
    ]);

    return {
      profile: profileResult.ok ? profileResult.data : null,
      menuRows,
      categories: categoryResult.ok ? categoryResult.data : null,
      restaurantReviews,
      dishReviews,
      cuisines: cuisineResult.ok ? cuisineResult.data : null,
      dietaryTags: dietaryResult.ok ? dietaryResult.data : null,
    };
  }

  // A dish from the backend -> a row of the menu table.
  function toMenuItem(dish, categories) {
    const category = categories.find(
      (item) => item.id === dish.category
    );

    return {
      id: dish.id,
      name: dish.name,
      price: dish.price ?? "",
      oldPrice: dish.old_price ?? "",
      category: category?.name || "",
      cuisine: (dish.cuisines || [])
        .map((item) => item.name)
        .join(", "),
      cuisineIds: (dish.cuisines || []).map((item) => item.id),
      dietaryTagIds: (dish.dietary_tags || []).map((item) => item.id),
      foodCategoryIds: (dish.food_categories || []).map(
        (item) => item.id
      ),
      description: dish.description || "",
      image: dish.image || "",
      available: dish.is_available,
    };
  }

  function readImageFile(file, onSuccess, onError) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      onError("Image must be smaller than 2 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      onSuccess(String(reader.result || ""));
    };

    reader.onerror = () => {
      onError("Could not read the image.");
    };

    reader.readAsDataURL(file);
  }

  function ProfileAvatar({ src, name, size = "small" }) {
    return (
      <div className={`owner-avatar owner-avatar-${size}`}>
        <img
          src={src || defaultProfileImage}
          alt={`${name || "Restaurant Owner"} profile`}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = defaultProfileImage;
          }}
        />
      </div>
    );
  }

 
function Field({
  label,
  icon: Icon,
  value,
  onChange,
  disabled = false,
  type = "text",
  placeholder = "",
}) {
  return (
    <label className="owner-profile-input-label">
      <span>{label}</span>

      <div
        className="owner-profile-input-wrap"
        style={{
          position: "relative",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        {Icon && type !== "time" && (
          <Icon
            size={17}
            className="owner-field-icon"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        )}

        <input
          type={type}
          value={value ?? ""}
          onChange={(event) => {
            if (typeof onChange === "function") {
              onChange(event.target.value);
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            paddingLeft:
              Icon && type !== "time" ? 42 : 12,
          }}
        />
      </div>
    </label>
  );
}


  function PasswordField({ label, value, onChange, disabled }) {
    const [visible, setVisible] = useState(false);

    return (
      <label className="owner-profile-input-label">
        <span>{label}</span>

        <div className="owner-profile-input-wrap">
          <LockKeyhole size={17} className="owner-field-icon" />

          <input
            type={visible ? "text" : "password"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            placeholder={label}
            autoComplete="new-password"
          />

          <button
            type="button"
            className="owner-password-eye"
            disabled={disabled}
            onClick={() => setVisible((previous) => !previous)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
    );
  }

  // ================= REVIEW HELPERS =================

  function normalizeRating(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return 0;

    return Math.max(0, Math.min(5, number));
  }

  function RatingStars({ rating, size = 18 }) {
    const safeRating = normalizeRating(rating);

    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
        }}
        aria-label={`${safeRating.toFixed(1)} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(
            0,
            Math.min(1, safeRating - (star - 1))
          );

          return (
            <span
              key={star}
              style={{
                position: "relative",
                display: "inline-block",
                width: size,
                height: size,
                fontSize: size,
                lineHeight: `${size}px`,
              }}
            >
              <span style={{ color: "#d0d0d0" }}>★</span>

              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  width: `${fill * 100}%`,
                  color: "#ffbf00",
                }}
              >
                ★
              </span>
            </span>
          );
        })}
      </div>
    );
  }

  function ReviewsSection({ reviews }) {
    const [reviewSearch, setReviewSearch] = useState("");

    const totalReviews = reviews.length;

    const averageRating = totalReviews
      ? reviews.reduce(
          (sum, review) => sum + normalizeRating(review.rating),
          0
        ) / totalReviews
      : 0;

    const ratingDistribution = [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((review) => {
        const rating = normalizeRating(review.rating);

        // Half-star ratings are grouped into the nearest full-star band.
        return Math.round(rating) === star;
      }).length;

      return {
        star,
        count,
        percentage: totalReviews
          ? Math.round((count / totalReviews) * 100)
          : 0,
      };
    });

    const filteredReviews = reviews.filter((review) => {
      const query = reviewSearch.trim().toLowerCase();

      return (
        !query ||
        `${review.food} ${review.text} ${review.customerName || ""}`
          .toLowerCase()
          .includes(query)
      );
    });

    const cardStyle = {
      background: "#f0ebe5",
      borderRadius: 12,
      padding: "24px 26px",
      boxShadow: "0 3px 12px rgba(0,0,0,0.04)",
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {/* AVERAGE RATING CARD */}

        <section style={cardStyle}>
          <h2
            style={{
              margin: "0 0 24px",
              fontSize: 21,
              fontWeight: 800,
              color: "#242424",
            }}
          >
            Average Rating
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 30,
              alignItems: "center",
            }}
          >
            {/* LEFT - BIG RATING */}

            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <span
                  style={{
                    fontSize: 65,
                    lineHeight: 1,
                    color: "#ffbf00",
                  }}
                >
                  ★
                </span>

                <strong
                  style={{
                    fontSize: 38,
                    color: "#ad260d",
                    fontWeight: 800,
                  }}
                >
                  {averageRating.toFixed(1)}
                </strong>
              </div>

              <div style={{ marginTop: 12 }}>
                <RatingStars rating={averageRating} size={19} />
              </div>

              <p
                style={{
                  margin: "15px 0 0",
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#242424",
                }}
              >
                ({totalReviews}{" "}
                {totalReviews === 1 ? "review" : "reviews"})
              </p>
            </div>

            {/* RIGHT - RATING DISTRIBUTION */}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {ratingDistribution.map((item) => (
                <div
                  key={item.star}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr 45px",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      color: "#b12810",
                      fontSize: 13,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.star} ★
                  </span>

                  <div
                    style={{
                      width: "100%",
                      height: 10,
                      background: "#d2d2d2",
                      borderRadius: 20,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${item.percentage}%`,
                        background: "#a9230c",
                        borderRadius: 20,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  <span
                    style={{
                      textAlign: "right",
                      color: "#a9230c",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* REVIEWS LIST CARD */}

        <section
          style={{
            ...cardStyle,
            minHeight: 330,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 15,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "#242424",
              }}
            >
              Reviews
            </h2>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
                border: "1px solid #ddd4ca",
                padding: "9px 12px",
                borderRadius: 7,
                minWidth: 220,
              }}
            >
              <Search size={16} color="#999" />

              <input
                type="search"
                value={reviewSearch}
                onChange={(event) =>
                  setReviewSearch(event.target.value)
                }
                placeholder="Search reviews..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  width: "100%",
                  minWidth: 0,
                  fontSize: 12,
                }}
              />
            </div>
          </div>

          <div className="owner-review-table">
            {filteredReviews.length === 0 ? (
              <p
                style={{
                  padding: "30px 0",
                  textAlign: "center",
                  color: "#888",
                }}
              >
                No customer reviews found.
              </p>
            ) : (
              filteredReviews.map((review) => (
                <div
                  key={review.id}
                  className="owner-review-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    padding: "16px 4px",
                    borderBottom: "1px solid #d8cec3",
                  }}
                >
                  <div
                    className="owner-review-description"
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 13,
                        color: "#242424",
                      }}
                    >
                      {review.food}
                    </strong>

                    <span
                      style={{
                        color: "#898989",
                        fontSize: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      {review.text}
                    </span>

                    {review.customerName && (
                      <small
                        style={{
                          color: "#9b7e6c",
                          fontSize: 11,
                        }}
                      >
                        — {review.customerName}
                      </small>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <RatingStars
                      rating={review.rating}
                      size={15}
                    />

                    <strong
                      style={{
                        color: "#bd6a00",
                        fontSize: 13,
                        minWidth: 28,
                      }}
                    >
                      {normalizeRating(review.rating).toFixed(1)}
                    </strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  // ================= MAIN COMPONENT =================

  export default function RestaurantOwnerDashboard({
    user = null,
    onLogout,
    onLogoutClick,
    onProfileUpdate,
  }) {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notification, setNotification] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // The restaurant of the signed-in owner (a number from the backend).
    const restaurantId = String(user?.restaurantId ?? "");

    // ================= PROFILE =================

    const [profile, setProfile] = useState(() =>
      createInitialProfile(user)
    );

    const [profileDraft, setProfileDraft] = useState(() =>
      createInitialProfile(user)
    );

    const [editingProfile, setEditingProfile] = useState(false);
    const [profilePassword, setProfilePassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // ================= RESTAURANT =================

    const [restaurantInfo, setRestaurantInfo] = useState(() =>
      createInitialRestaurant(user)
    );

    const [restaurantDraft, setRestaurantDraft] = useState(() =>
      createInitialRestaurant(user)
    );

    const [editingRestaurant, setEditingRestaurant] = useState(false);


    // The tags a dish can get, as { id, name }: cuisines, dietary tags and food categories.
    const [cuisineList, setCuisineList] = useState([]);
    const [dietaryList, setDietaryList] = useState([]);

    // Open / closed, meals, occasions and the map position of the restaurant.
    const [isTemporarilyClosed, setIsTemporarilyClosed] = useState(false);
    const [mealTypes, setMealTypes] = useState([]);
    const [diningOccasions, setDiningOccasions] = useState([]);
    const [mapPosition, setMapPosition] = useState(null);

    // The address typed in the map card (null = the saved address, area and city).
    const [mapAddress, setMapAddress] = useState(null);

    // The weekly opening hours: [{ day, name, open, close, closed }], Monday first.
    const [schedule, setSchedule] = useState([]);

    // The "Manage Categories" popup and the category being renamed.
    const [categoriesOpen, setCategoriesOpen] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [newSectionName, setNewSectionName] = useState("");

    // ================= MANAGE MENU =================

    const [menuItems, setMenuItems] = useState([]);

    // The restaurant's own menu sections: [{ id, name }]
    const [menuSections, setMenuSections] = useState([]);

    const [menuFilter, setMenuFilter] = useState("all");
    const [menuSearch, setMenuSearch] = useState("");

    const [foodModalOpen, setFoodModalOpen] = useState(false);
    const [editingFoodId, setEditingFoodId] = useState(null);
    const [foodDraft, setFoodDraft] = useState({ ...EMPTY_FOOD });

    // ================= CUSTOMER REVIEWS =================

    // [{ id, food, text, rating, customerName }] and how many there are in all.
    const [reviews, setReviews] = useState([]);
    const [reviewTotal, setReviewTotal] = useState(0);

    // ================= LOAD FROM THE BACKEND =================

    // Puts what the backend answered into the page.
    // withProfile: also replace the profile and restaurant forms (only when nothing is being edited).
    const applyOwnerData = useCallback((data, withProfile) => {
      if (data.cuisines) {
        setCuisineList(data.cuisines);
      }

      if (data.dietaryTags) setDietaryList(data.dietaryTags);


      if (data.categories) {
        setMenuSections(
          data.categories.map((item) => ({
            id: item.id,
            name: item.name,
          }))
        );
      }

      if (data.menuRows && data.categories) {
        setMenuItems(
          data.menuRows.map((dish) =>
            toMenuItem(dish, data.categories)
          )
        );
      }

      if (data.restaurantReviews || data.dishReviews) {
        const restaurantRows = data.restaurantReviews?.rows ?? [];
        const dishRows = data.dishReviews?.rows ?? [];

        setReviews(
          [
            ...restaurantRows.map((review) => ({
              id: `restaurant-${review.id}`,
              food: data.profile?.name || "Restaurant",
              text: review.comment || "",
              rating: Number(review.rating) || 0,
              customerName: review.customer_name,
              when: review.updated_at,
            })),
            ...dishRows.map((review) => ({
              id: `dish-${review.id}`,
              food: review.dish.name,
              text: review.comment || "",
              rating: Number(review.rating) || 0,
              customerName: review.customer_name,
              when: review.updated_at,
            })),
          ].sort(
            (a, b) =>
              (Date.parse(b.when) || 0) - (Date.parse(a.when) || 0)
          )
        );

        setReviewTotal(
          (data.restaurantReviews?.count ?? 0) +
            (data.dishReviews?.count ?? 0)
        );
      }

      if (withProfile && data.profile) {
        const saved = data.profile;

        setSchedule(
          (saved.opening_hours || []).map((day) => ({
            day: day.day_of_week,
            name: day.day_name,
            open: toTimeInput(day.open_time),
            close: toTimeInput(day.close_time),
            closed: Boolean(day.is_closed),
          }))
        );

        setProfile((previous) => ({
          ...previous,
          restaurantName: saved.name,
          phone: saved.phone_no || previous.phone,
          city: saved.city || previous.city,
          area: saved.area || previous.area,
          address: saved.location || previous.address,
          profileImage: saved.logo || previous.profileImage,
        }));

        setProfileDraft((previous) => ({
          ...previous,
          restaurantName: saved.name,
          phone: saved.phone_no || previous.phone,
          city: saved.city || previous.city,
          area: saved.area || previous.area,
          address: saved.location || previous.address,
          profileImage: saved.logo || previous.profileImage,
        }));

        setIsTemporarilyClosed(Boolean(saved.is_temporarily_closed));
        setMealTypes(saved.meal_types || []);
        setDiningOccasions(saved.dining_occasions || []);

        setMapPosition(
          saved.latitude != null && saved.longitude != null
            ? { latitude: saved.latitude, longitude: saved.longitude }
            : null
        );

        const nextRestaurant = {
          name: saved.name,
          description: saved.description || "",
          address: saved.location || "",
          image: saved.cover_image || "",
          minPrice: saved.min_price == null ? "" : String(saved.min_price),
          maxPrice: saved.max_price == null ? "" : String(saved.max_price),
          cuisineType: saved.cuisines?.[0]?.name || "",
        };

        setRestaurantInfo((previous) => ({
          ...previous,
          ...nextRestaurant,
        }));

        setRestaurantDraft((previous) => ({
          ...previous,
          ...nextRestaurant,
        }));
      }
    }, []);

    // Load the menu and reviews again (after the owner changed something).
    const refreshMenuAndReviews = useCallback(
      () =>
        loadOwnerData(restaurantId).then((data) =>
          applyOwnerData(data, false)
        ),
      [restaurantId, applyOwnerData]
    );

    useEffect(() => {
      if (!restaurantId) return undefined;

      let active = true;

      loadOwnerData(restaurantId).then((data) => {
        if (active) applyOwnerData(data, true);
      });

      return () => {
        active = false;
      };
    }, [restaurantId, applyOwnerData]);

    // ================= STATS =================

    const menuCategories = [
      ...new Set(
        menuItems.map((food) => food.category).filter(Boolean)
      ),
    ];

    const stats = [
      { label: "Restaurant", value: 1, icon: Store },
      {
        label: "Menu Items",
        value: menuItems.length,
        icon: UtensilsCrossed,
      },
      {
        label: "Food Item Categories",
        value: menuCategories.length,
        icon: Menu,
      },
      {
        label: "Reviews",
        value: reviewTotal,
        icon: MessageSquareText,
      },
    ];

    // The choices in the Category box of the food form: only the categories this restaurant created.
    const foodCategoryOptions = menuSections.map(
      (section) => section.name
    );

    const filteredMenu = menuItems.filter((food) => {
      const matchesFilter =
        menuFilter === "all" ||
        (menuFilter === "available" && food.available) ||
        (menuFilter === "unavailable" && !food.available);

      const searchText = menuSearch.trim().toLowerCase();

      const matchesSearch =
        !searchText ||
        `${food.name} ${food.cuisine || ""} ${food.category} ${food.description || ""}`
          .toLowerCase()
          .includes(searchText);

      return matchesFilter && matchesSearch;
    });

    // ================= COMMON ACTIONS =================

    const showNotification = (message) => {
      setNotification(message);
    };

    const handleTabChange = (tab) => {
      setActiveTab(tab);
      setSidebarOpen(false);
      setNotification("");
    };

    const handleLogout = () => {
      (onLogout || onLogoutClick)?.();
    };

    // What the backend saved for the restaurant -> the profile and restaurant forms and the signed-in user.
    const applySavedRestaurant = (saved) => {
      setProfile((previous) => ({
        ...previous,
        ownerName: saved.owner_name || "",
        restaurantName: saved.name,
        email: saved.email || "",
        phone: saved.phone_no || "",
        city: saved.city || "",
        area: saved.area || "",
        address: saved.location || "",
        businessRegistration: saved.business_reg_id || "",
        profileImage: saved.logo || "",
      }));

      setProfileDraft((previous) => ({
        ...previous,
        ownerName: saved.owner_name || "",
        restaurantName: saved.name,
        email: saved.email || "",
        phone: saved.phone_no || "",
        city: saved.city || "",
        area: saved.area || "",
        address: saved.location || "",
        businessRegistration: saved.business_reg_id || "",
        profileImage: saved.logo || "",
      }));

      const nextRestaurant = {
        name: saved.name,
        description: saved.description || "",
        address: saved.location || "",
        image: saved.cover_image || "",
        minPrice: saved.min_price == null ? "" : String(saved.min_price),
        maxPrice: saved.max_price == null ? "" : String(saved.max_price),
      };

      setRestaurantInfo((previous) => ({
        ...previous,
        ...nextRestaurant,
      }));

      setRestaurantDraft((previous) => ({
        ...previous,
        ...nextRestaurant,
      }));

      // The Navbar and a reload show the new details too.
      onProfileUpdate?.(mapBackendUser("restaurant", saved));
    };

    // Saves part of the restaurant's details. form: a FormData with the fields to change.
    // Resolves to true when the backend accepted it.
    const saveRestaurantFields = async (form) => {
      const { ok, data } = await apiCall(
        `/api/update_restaurant_profile/${restaurantId}/`,
        { method: "PUT", body: form }
      );

      if (!ok) {
        showNotification(errorMessage(data));
        return false;
      }

      applySavedRestaurant(data);

      return true;
    };

    // ================= PROFILE ACTIONS =================

    const startEditingProfile = () => {
      setProfileDraft({ ...profile });
      setProfilePassword("");
      setConfirmPassword("");
      setEditingProfile(true);
      setNotification("");
    };

    const cancelEditingProfile = () => {
      setProfileDraft({ ...profile });
      setProfilePassword("");
      setConfirmPassword("");
      setEditingProfile(false);
    };

    const updateProfileField = (field, value) => {
      setProfileDraft((previous) => ({
        ...previous,
        [field]: value,
      }));
    };

    const handleProfileImageUpload = (event) => {
      const file = event.target.files?.[0];

      if (!editingProfile || !file) return;

      readImageFile(
        file,
        (image) => updateProfileField("profileImage", image),
        showNotification
      );

      event.target.value = "";
    };

    const handleSaveProfile = async (event) => {
      event.preventDefault();

      if (isSaving) return;

      if (!profileDraft.restaurantName.trim()) {
        showNotification("Restaurant name cannot be empty.");
        return;
      }

      if (
        profileDraft.email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          profileDraft.email.trim()
        )
      ) {
        showNotification("Please enter a valid email.");
        return;
      }

      if (profilePassword || confirmPassword) {
        if (profilePassword.length < 6) {
          showNotification(
            "Password must be at least 6 characters."
          );
          return;
        }

        if (profilePassword !== confirmPassword) {
          showNotification(
            "Password and Confirm Password do not match."
          );
          return;
        }
      }

      const form = new FormData();

      form.append("owner_name", profileDraft.ownerName.trim());
      form.append("name", profileDraft.restaurantName.trim());
      form.append("email", profileDraft.email.trim());
      form.append("phone_no", profileDraft.phone.trim());
      form.append("city", profileDraft.city.trim());
      form.append("area", profileDraft.area.trim());
      form.append("location", profileDraft.address.trim());
      form.append(
        "business_reg_id",
        profileDraft.businessRegistration.trim()
      );

      if (profilePassword) form.append("password", profilePassword);

      // A picture chosen just now is sent as a file; a removed one as an empty value.
      if (profileDraft.profileImage.startsWith("data:")) {
        const { blob, filename } = await dataUrlToFile(
          profileDraft.profileImage,
          "logo"
        );

        form.append("logo", blob, filename);
      } else if (!profileDraft.profileImage && profile.profileImage) {
        form.append("logo", "");
      }

      setIsSaving(true);

      const saved = await saveRestaurantFields(form);

      setIsSaving(false);

      if (!saved) return;

      setEditingProfile(false);
      setProfilePassword("");
      setConfirmPassword("");

      showNotification(
        profilePassword
          ? "Profile saved. Your password has been changed."
          : "Profile saved successfully."
      );
    };

    // ================= RESTAURANT ACTIONS =================

    const startEditingRestaurant = () => {
      setRestaurantDraft({ ...restaurantInfo });
      setEditingRestaurant(true);
      setNotification("");
    };

    const cancelEditingRestaurant = () => {
      setRestaurantDraft({ ...restaurantInfo });
      setEditingRestaurant(false);
    };

    const updateRestaurantField = (field, value) => {
      setRestaurantDraft((previous) => ({
        ...previous,
        [field]: value,
      }));
    };

    const handleRestaurantImageUpload = (event) => {
      const file = event.target.files?.[0];

      if (!editingRestaurant || !file) return;

      readImageFile(
        file,
        (image) => updateRestaurantField("image", image),
        showNotification
      );

      event.target.value = "";
    };

    const handleSaveRestaurant = async (event) => {
      event.preventDefault();

      if (isSaving) return;

      if (!restaurantDraft.name.trim()) {
        showNotification("Restaurant name cannot be empty.");
        return;
      }

      const minPrice = String(restaurantDraft.minPrice).trim();
      const maxPrice = String(restaurantDraft.maxPrice).trim();

      for (const value of [minPrice, maxPrice]) {
        if (value !== "" && !/^\d+$/.test(value)) {
          showNotification(
            "Prices must be whole numbers, 0 or more."
          );
          return;
        }
      }

      if (
        minPrice !== "" &&
        maxPrice !== "" &&
        Number(minPrice) > Number(maxPrice)
      ) {
        showNotification(
          "Minimum price cannot be higher than the maximum price."
        );
        return;
      }

      const form = new FormData();

      form.append("name", restaurantDraft.name.trim());
      form.append("description", restaurantDraft.description.trim());
      form.append("min_price", minPrice);
      form.append("max_price", maxPrice);

      if (restaurantDraft.image.startsWith("data:")) {
        const { blob, filename } = await dataUrlToFile(
          restaurantDraft.image,
          "cover"
        );

        form.append("cover_image", blob, filename);
      } else if (!restaurantDraft.image && restaurantInfo.image) {
        form.append("cover_image", "");
      }

      setIsSaving(true);

      const saved = await saveRestaurantFields(form);

      setIsSaving(false);

      if (!saved) return;

      setEditingRestaurant(false);

      showNotification(
        "Restaurant information saved successfully."
      );
    };

    // ================= MENU ACTIONS =================

    const openAddFoodModal = () => {
      setEditingFoodId(null);

      setFoodDraft({
        ...EMPTY_FOOD,
        category: foodCategoryOptions[0] || "",
      });

      setFoodModalOpen(true);
      setNotification("");
    };

    const openEditFoodModal = (food) => {
      setEditingFoodId(food.id);

      setFoodDraft({
        name: food.name || "",
        category: food.category || foodCategoryOptions[0] || "",
        price: String(food.price ?? ""),
        oldPrice: String(food.oldPrice ?? ""),
        description: food.description || "",
        image: food.image || "",
        available: food.available !== false,
        cuisines: food.cuisineIds || [],
        dietaryTags: food.dietaryTagIds || [],
        foodCategories: food.foodCategoryIds || [],
      });

      setFoodModalOpen(true);
      setNotification("");
    };

    const closeFoodModal = () => {
      setFoodModalOpen(false);
      setEditingFoodId(null);
      setFoodDraft({ ...EMPTY_FOOD });
    };

    const updateFoodField = (field, value) => {
      setFoodDraft((previous) => ({
        ...previous,
        [field]: value,
      }));
    };

    const handleFoodImageUpload = (event) => {
      const file = event.target.files?.[0];

      if (!file) return;

      readImageFile(
        file,
        (image) => updateFoodField("image", image),
        showNotification
      );

      event.target.value = "";
    };

    // The id of the restaurant's menu section with this name; it is created when it does not exist yet.
    const findOrCreateSection = async (name) => {
      const existing = menuSections.find(
        (section) =>
          section.name.toLowerCase() === name.toLowerCase()
      );

      if (existing) return existing.id;

      const { ok, data } = await apiCall(
        "/api/create_menu_category/",
        { method: "POST", body: { name } }
      );

      if (!ok) throw new Error(errorMessage(data));

      return data.data.id;
    };

    const handleSaveFood = async (event) => {
      event.preventDefault();

      if (isSaving) return;

      const name = foodDraft.name.trim();
      const category = foodDraft.category.trim();
      const price = Number(foodDraft.price);

      const oldPrice = foodDraft.oldPrice
        ? Number(foodDraft.oldPrice)
        : "";

      if (!name) {
        showNotification("Please enter a food name.");
        return;
      }

      if (!category) {
        showNotification(
          foodCategoryOptions.length === 0
            ? "Create a category first with Manage Categories."
            : "Please select a category."
        );
        return;
      }

      if (!Number.isFinite(price) || price <= 0) {
        showNotification("Please enter a valid price.");
        return;
      }

      if (
        oldPrice !== "" &&
        (!Number.isFinite(oldPrice) || oldPrice < 0)
      ) {
        showNotification("Please enter a valid old price.");
        return;
      }

      setIsSaving(true);

      try {
        const sectionId = await findOrCreateSection(category);

        const form = new FormData();

        form.append("name", name);
        form.append("category", String(sectionId));
        form.append("price", String(price));
        form.append("old_price", oldPrice === "" ? "" : String(oldPrice));
        form.append("description", foodDraft.description.trim());
        form.append("is_available", String(foodDraft.available));

        const current = menuItems.find(
          (food) => food.id === editingFoodId
        );

        if (foodDraft.image.startsWith("data:")) {
          const { blob, filename } = await dataUrlToFile(
            foodDraft.image,
            "dish"
          );

          form.append("image", blob, filename);
        } else if (!foodDraft.image && current?.image) {
          form.append("image", "");
        }

        const wasAdding = editingFoodId === null;

        const { ok, data } = await apiCall(
          wasAdding
            ? "/api/create_menu_item/"
            : `/api/update_menu_item/${editingFoodId}/`,
          { method: wasAdding ? "POST" : "PUT", body: form }
        );

        if (!ok) {
          showNotification(errorMessage(data));
          return;
        }

        // The tags are sent on their own: a list in a JSON body can also be emptied.
        const hasTags =
          foodDraft.cuisines.length > 0 ||
          foodDraft.dietaryTags.length > 0 ||
          foodDraft.foodCategories.length > 0;

        if (!wasAdding || hasTags) {
          const dishId = wasAdding ? data.data.id : editingFoodId;

          const tagResult = await apiCall(
            `/api/update_menu_item/${dishId}/`,
            {
              method: "PUT",
              body: {
                cuisines: foodDraft.cuisines,
                dietary_tags: foodDraft.dietaryTags,
                food_categories: foodDraft.foodCategories,
              },
            }
          );

          if (!tagResult.ok) {
            showNotification(errorMessage(tagResult.data));
            await refreshMenuAndReviews();
            return;
          }
        }

        closeFoodModal();

        showNotification(
          wasAdding
            ? "Food item added successfully."
            : "Food item updated successfully."
        );

        await refreshMenuAndReviews();
      } catch (error) {
        showNotification(error.message);
      } finally {
        setIsSaving(false);
      }
    };

    const toggleAvailability = async (foodId) => {
      const food = menuItems.find((item) => item.id === foodId);

      if (!food) return;

      // Show the change at once; undo it if the backend says no.
      setMenuItems((previous) =>
        previous.map((item) =>
          item.id === foodId
            ? { ...item, available: !item.available }
            : item
        )
      );

      const { ok, data } = await apiCall(
        `/api/update_menu_item_availability/${foodId}/`,
        {
          method: "PUT",
          body: { is_available: !food.available },
        }
      );

      if (!ok) {
        showNotification(errorMessage(data));
        refreshMenuAndReviews();
      }
    };

    const deleteFood = async (foodId) => {
      if (!window.confirm("Delete this food item?")) {
        return;
      }

      const { ok, data } = await apiCall(
        `/api/delete_menu_item/${foodId}/`,
        { method: "DELETE" }
      );

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      showNotification("Food item deleted successfully.");

      await refreshMenuAndReviews();
    };

    // Adds or removes one id / value from a list kept in the food form.
    const toggleFoodChoice = (field, value) => {
      setFoodDraft((previous) => ({
        ...previous,
        [field]: previous[field].includes(value)
          ? previous[field].filter((item) => item !== value)
          : [...previous[field], value],
      }));
    };

    // ================= MENU CATEGORY ACTIONS =================

    const handleAddSection = async (event) => {
      event.preventDefault();

      const name = newSectionName.trim();

      if (!name) {
        showNotification("Enter a category name.");
        return;
      }

      if (
        menuSections.some(
          (section) =>
            section.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        showNotification("You already have a category with that name.");
        return;
      }

      setIsSaving(true);

      const { ok, data } = await apiCall("/api/create_menu_category/", {
        method: "POST",
        body: { name },
      });

      setIsSaving(false);

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      setNewSectionName("");

      showNotification("Category added.");

      await refreshMenuAndReviews();
    };

    const startRenaming = (section) => {
      setRenamingId(section.id);
      setRenameValue(section.name);
    };

    const saveRename = async (section) => {
      const name = renameValue.trim();

      if (!name) {
        showNotification("Category name cannot be empty.");
        return;
      }

      if (name !== section.name) {
        const { ok, data } = await apiCall(
          `/api/update_menu_category/${section.id}/`,
          { method: "PUT", body: { name } }
        );

        if (!ok) {
          showNotification(errorMessage(data));
          return;
        }

        showNotification("Category renamed.");

        await refreshMenuAndReviews();
      }

      setRenamingId(null);
    };

    const deleteSection = async (section) => {
      if (
        !window.confirm(
          `Delete the category "${section.name}"? Its dishes are kept.`
        )
      ) {
        return;
      }

      const { ok, data } = await apiCall(
        `/api/delete_menu_category/${section.id}/`,
        { method: "DELETE" }
      );

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      showNotification("Category deleted.");

      await refreshMenuAndReviews();
    };

    // ================= OPEN / CLOSED, DINING AND MAP =================

    const handleToggleClosure = async () => {
      const next = !isTemporarilyClosed;

      const { ok, data } = await apiCall(
        "/api/update_temporary_closure/",
        { method: "PUT", body: { is_temporarily_closed: next } }
      );

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      setIsTemporarilyClosed(next);

      showNotification(
        next
          ? "Your restaurant is now shown as temporarily closed."
          : "Your restaurant follows its opening hours again."
      );
    };

    const toggleDiningChoice = (setList, value) => {
      setList((previous) =>
        previous.includes(value)
          ? previous.filter((item) => item !== value)
          : [...previous, value]
      );
    };

    const handleSaveDining = async () => {
      if (isSaving) return;

      setIsSaving(true);

      const { ok, data } = await apiCall("/api/update_dining_info/", {
        method: "PUT",
        body: {
          meal_types: mealTypes,
          dining_occasions: diningOccasions,
        },
      });

      setIsSaving(false);

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      showNotification("Meals and occasions saved successfully.");
    };

    const updateScheduleDay = (day, changes) => {
      setSchedule((previous) =>
        previous.map((entry) =>
          entry.day === day ? { ...entry, ...changes } : entry
        )
      );
    };

    // Days left empty and not closed stay "not set".
    const handleSaveSchedule = async () => {
      if (isSaving) return;

      const entries = [];

      for (const entry of schedule) {
        if (entry.closed) {
          entries.push({ day_of_week: entry.day, is_closed: true });
          continue;
        }

        if (!entry.open && !entry.close) continue;

        if (!entry.open || !entry.close) {
          showNotification(
            `${entry.name}: enter both the opening and closing time.`
          );
          return;
        }

        if (entry.open === entry.close) {
          showNotification(
            `${entry.name}: opening and closing time cannot be the same.`
          );
          return;
        }

        entries.push({
          day_of_week: entry.day,
          open_time: entry.open,
          close_time: entry.close,
          is_closed: false,
        });
      }

      if (entries.length === 0) {
        showNotification("Set the hours of at least one day.");
        return;
      }

      setIsSaving(true);

      const { ok, data } = await apiCall("/api/update_opening_hours/", {
        method: "PUT",
        body: entries,
      });

      setIsSaving(false);

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      showNotification("Opening hours saved successfully.");
    };

    const defaultMapAddress = [
      restaurantInfo.address,
      profile.area,
      profile.city,
    ]
      .filter(Boolean)
      .join(", ");

    const handleLocateRestaurant = async () => {
      if (isSaving) return;

      const address = (mapAddress ?? defaultMapAddress).trim();

      if (!address) {
        showNotification("Enter an address to find on the map.");
        return;
      }

      setIsSaving(true);

      const { ok, data } = await apiCall("/api/locate_my_restaurant/", {
        method: "POST",
        body: { address },
      });

      setIsSaving(false);

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      setMapPosition({
        latitude: data.latitude,
        longitude: data.longitude,
        place: data.matched_place,
      });

      showNotification("Your restaurant was found on the map.");
    };

    // ================= DELETE ACCOUNT =================

    const handleDeleteAccount = async () => {
      if (
        !window.confirm(
          "Delete your restaurant account? Your menu, offers and reviews will be removed for good."
        )
      ) {
        return;
      }

      const { ok, data } = await apiCall(
        `/api/delete_restaurant/${restaurantId}/`,
        { method: "DELETE" }
      );

      if (!ok) {
        showNotification(errorMessage(data));
        return;
      }

      handleLogout();
    };

    // ================= MODAL EFFECT =================

    useEffect(() => {
      if (!foodModalOpen) return;

      const previousOverflow =
        document.body.style.overflow;

      document.body.style.overflow = "hidden";

      const handleEscape = (event) => {
        if (event.key === "Escape") {
          setFoodModalOpen(false);
        }
      };

      document.addEventListener(
        "keydown",
        handleEscape
      );

      return () => {
        document.body.style.overflow =
          previousOverflow;

        document.removeEventListener(
          "keydown",
          handleEscape
        );
      };
    }, [foodModalOpen]);

    // ================= UI =================

    return (
      <div className="owner-page">
        {/* MOBILE MENU */}

        <button
          type="button"
          className="owner-mobile-toggle"
          onClick={() =>
            setSidebarOpen((previous) => !previous)
          }
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <X size={23} />
          ) : (
            <Menu size={23} />
          )}
        </button>

        {sidebarOpen && (
          <button
            type="button"
            className="owner-mobile-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* SIDEBAR */}

        <aside
          className={`owner-sidebar ${
            sidebarOpen ? "owner-sidebar-open" : ""
          }`}
        >
          <div className="owner-brand">
            <img
              src={logoImage}
              alt="NearBite logo"
              className="owner-brand-logo"
            />

            <span className="owner-brand-text">
              Near<span>Bite</span>
            </span>
          </div>

          <nav className="owner-sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`owner-nav-button ${
                    activeTab === item.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleTabChange(item.id)
                  }
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            className="owner-logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            Logout
          </button>
        </aside>

        {/* MAIN PANEL */}

        <main className="owner-main">
          {/* HEADER */}

          <header className="owner-header">
            <div className="owner-header-text">
              <h1>
                {activeTab === "dashboard"
                  ? "Restaurant Owner Dashboard"
                  : activeTab === "restaurant"
                  ? "Restaurant Information"
                  : NAV_ITEMS.find(
                      (item) =>
                        item.id === activeTab
                    )?.label}
              </h1>

              <p>
                {activeTab === "dashboard"
                  ? "Welcome back! Here's what's happening with your restaurant"
                  : activeTab === "profile"
                  ? "Edit Your Own Profile"
                  : activeTab === "restaurant"
                  ? "Update your restaurant details"
                  : activeTab === "menu"
                  ? "Add, Edit or Remove food items from your menu"
                  : activeTab === "offers"
                  ? "Create and manage your daily deals"
                  : "See what customers say about your restaurant"}
              </p>
            </div>

            <button
              type="button"
              className="owner-header-profile"
              onClick={() =>
                handleTabChange("profile")
              }
              title="Open My Profile"
            >
              <ProfileAvatar
                src={profile.profileImage}
                name={profile.ownerName}
              />

              <span className="owner-header-identity">
                <strong>
                  {restaurantInfo.name}
                </strong>
                <small>{profile.ownerName}</small>
              </span>
            </button>
          </header>

          {/* NOTIFICATION */}

          {notification && (
            <div
              className="owner-notification"
              role="status"
            >
              <span>{notification}</span>

              <button
                type="button"
                onClick={() =>
                  setNotification("")
                }
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          {/* ================= DASHBOARD ================= */}

          {activeTab === "dashboard" && (
            <>
              <section className="owner-stats-grid">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <article
                      key={stat.label}
                      className="owner-stat-card"
                    >
                      <div className="owner-stat-label">
                        <Icon size={15} />
                        <span>{stat.label}</span>
                      </div>

                      <strong>{stat.value}</strong>
                    </article>
                  );
                })}
              </section>

              <section className="owner-review-panel">
                <h2>Recent Review</h2>

                <div className="owner-review-table">
                  {reviews.slice(0, 5).map((review) => (
                    <div
                      key={review.id}
                      className="owner-review-row"
                    >
                      <div className="owner-review-description">
                        <strong>{review.food}</strong>
                        <span>({review.text})</span>
                      </div>

                      <span className="owner-review-rating">
                        <Star
                          size={15}
                          fill="currentColor"
                        />
                        {normalizeRating(
                          review.rating
                        ).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ================= MY PROFILE ================= */}

          {activeTab === "profile" && (
            <section className="owner-content-card owner-profile-card">
              <div className="owner-section-heading">
                <h2>My Profile</h2>

                <button
                  type="button"
                  className={
                    editingProfile
                      ? "owner-secondary-button"
                      : "owner-profile-edit-button"
                  }
                  onClick={
                    editingProfile
                      ? cancelEditingProfile
                      : startEditingProfile
                  }
                >
                  {editingProfile ? (
                    <X size={15} />
                  ) : (
                    <Pencil size={15} />
                  )}

                  {editingProfile
                    ? "Cancel"
                    : "Edit"}
                </button>
              </div>

              <form
                className="owner-profile-new-layout"
                onSubmit={handleSaveProfile}
              >
                <div className="owner-profile-photo-column">
                  <ProfileAvatar
                    src={
                      editingProfile
                        ? profileDraft.profileImage
                        : profile.profileImage
                    }
                    name={profile.ownerName}
                    size="large"
                  />

                  <label
                    className={`owner-change-image-button ${
                      !editingProfile
                        ? "owner-image-disabled"
                        : ""
                    }`}
                  >
                    <Camera size={15} />
                    Change Image

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleProfileImageUpload
                      }
                      disabled={!editingProfile}
                      hidden
                    />
                  </label>
                </div>

                <div className="owner-profile-new-fields">
                  <Field
                    label="Owner Name"
                    icon={UserRound}
                    value={profileDraft.ownerName}
                    onChange={(value) =>
                      updateProfileField(
                        "ownerName",
                        value
                      )
                    }
                    disabled={!editingProfile}
                    placeholder="Enter owner name"
                  />

                  <Field
                    label="Restaurant Name"
                    icon={Store}
                    value={
                      profileDraft.restaurantName
                    }
                    onChange={(value) =>
                      updateProfileField(
                        "restaurantName",
                        value
                      )
                    }
                    disabled={!editingProfile}
                    placeholder="Enter restaurant name"
                  />

                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    value={profileDraft.email}
                    onChange={(value) =>
                      updateProfileField(
                        "email",
                        value
                      )
                    }
                    disabled={!editingProfile}
                    placeholder="Enter your email"
                  />

                  <Field
                    label="Number"
                    icon={Phone}
                    type="tel"
                    value={profileDraft.phone}
                    onChange={(value) =>
                      updateProfileField(
                        "phone",
                        value
                      )
                    }
                    disabled={!editingProfile}
                    placeholder="Enter your number"
                  />

                  <div className="owner-profile-location-row">
                    <label className="owner-profile-input-label">
                      <span>City</span>

                      <div className="owner-profile-input-wrap">
                        <MapPin
                          size={17}
                          className="owner-field-icon"
                        />

                        <select
                          value={profileDraft.city}
                          disabled={!editingProfile}
                          onChange={(event) =>
                            setProfileDraft(
                              (previous) => ({
                                ...previous,
                                city:
                                  event.target.value,
                                area: "",
                              })
                            )
                          }
                        >
                          <option value="">
                            Select City
                          </option>
                          <option value="Dhaka">
                            Dhaka
                          </option>
                          <option value="Chattogram">
                            Chattogram
                          </option>
                          <option value="Sylhet">
                            Sylhet
                          </option>
                          <option value="Khulna">
                            Khulna
                          </option>
                          <option value="Rajshahi">
                            Rajshahi
                          </option>
                          <option value="Barishal">
                            Barishal
                          </option>
                          <option value="Rangpur">
                            Rangpur
                          </option>
                          <option value="Mymensingh">
                            Mymensingh
                          </option>
                        </select>
                      </div>
                    </label>

                    <Field
                      label="Area"
                      icon={MapPin}
                      value={profileDraft.area}
                      onChange={(value) =>
                        updateProfileField(
                          "area",
                          value
                        )
                      }
                      disabled={!editingProfile}
                      placeholder="Enter your area"
                    />
                  </div>

                  <Field
                    label="Address / Location"
                    icon={MapPin}
                    value={profileDraft.address}
                    onChange={(value) =>
                      updateProfileField(
                        "address",
                        value
                      )
                    }
                    disabled={!editingProfile}
                    placeholder="Enter your location"
                  />

                  <Field
                    label="Business Registration No."
                    icon={IdCard}
                    value={
                      profileDraft.businessRegistration
                    }
                    onChange={(value) =>
                      updateProfileField(
                        "businessRegistration",
                        value
                      )
                    }
                    disabled={!editingProfile}
                    placeholder="Enter registration number"
                  />

                  <PasswordField
                    label="New Password"
                    value={profilePassword}
                    onChange={setProfilePassword}
                    disabled={!editingProfile}
                  />

                  <PasswordField
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    disabled={!editingProfile}
                  />

                  {editingProfile && (
                    <div className="owner-profile-save-wrap">
                      <button
                        type="submit"
                        className="owner-primary-button"
                      >
                        <Save size={16} />
                        Save and Change
                      </button>
                    </div>
                  )}
                </div>
              </form>

              <div className="owner-danger-zone">
                <div>
                  <strong>Delete Account</strong>
                  <p>
                    This removes your restaurant, menu, offers and
                    reviews for good.
                  </p>
                </div>

                <button
                  type="button"
                  className="owner-menu-delete owner-danger-button"
                  onClick={handleDeleteAccount}
                >
                  <Trash2 size={15} />
                  Delete Account
                </button>
              </div>
            </section>
          )}

          {/* ================= RESTAURANT INFO ================= */}

          {activeTab === "restaurant" && (
            <>
            <section className="owner-content-card owner-profile-card owner-restaurant-info-card">
              <div className="owner-section-heading">
                <h2>Basic Information</h2>

                <button
                  type="button"
                  className={
                    editingRestaurant
                      ? "owner-secondary-button"
                      : "owner-profile-edit-button"
                  }
                  onClick={
                    editingRestaurant
                      ? cancelEditingRestaurant
                      : startEditingRestaurant
                  }
                >
                  {editingRestaurant ? (
                    <X size={15} />
                  ) : (
                    <Pencil size={15} />
                  )}

                  {editingRestaurant
                    ? "Cancel"
                    : "Edit"}
                </button>
              </div>

              <form
                className="owner-profile-new-layout owner-restaurant-info-layout"
                onSubmit={handleSaveRestaurant}
              >
                <div className="owner-profile-photo-column owner-restaurant-image-column">
                  <span className="owner-restaurant-image-title">
                    Restaurant Image
                  </span>

                  <div className="owner-restaurant-image-preview">
                    {(
                      editingRestaurant
                        ? restaurantDraft.image
                        : restaurantInfo.image
                    ) ? (
                      <img
                        src={
                          editingRestaurant
                            ? restaurantDraft.image
                            : restaurantInfo.image
                        }
                        alt={restaurantInfo.name}
                      />
                    ) : (
                      <ImageIcon
                        size={82}
                        strokeWidth={1.5}
                      />
                    )}
                  </div>

                  <label
                    className={`owner-change-image-button ${
                      !editingRestaurant
                        ? "owner-image-disabled"
                        : ""
                    }`}
                  >
                    <Camera size={15} />
                    Change Image

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleRestaurantImageUpload
                      }
                      disabled={
                        !editingRestaurant
                      }
                      hidden
                    />
                  </label>
                </div>

                <div className="owner-profile-new-fields owner-restaurant-info-fields">
                  <Field
                    label="Restaurant Name"
                    icon={Store}
                    value={restaurantDraft.name}
                    onChange={(value) =>
                      updateRestaurantField(
                        "name",
                        value
                      )
                    }
                    disabled={!editingRestaurant} 
                    placeholder="Enter restaurant name"
                  />

                  <Field
                    label="Minimum Price (৳)"
                    icon={Tag}
                    type="number"
                    value={restaurantDraft.minPrice}
                    onChange={(value) =>
                      updateRestaurantField("minPrice", value)
                    }
                    disabled={!editingRestaurant}
                    placeholder="e.g. 100"
                  />

                  <Field
                    label="Maximum Price (৳)"
                    icon={Tag}
                    type="number"
                    value={restaurantDraft.maxPrice}
                    onChange={(value) =>
                      updateRestaurantField("maxPrice", value)
                    }
                    disabled={!editingRestaurant}
                    placeholder="e.g. 800"
                  />

                  <label className="owner-profile-input-label owner-restaurant-description">
                    <span>Description</span>

                    <div className="owner-restaurant-textarea-wrap">
                      <textarea
                        rows={3}
                        value={
                          restaurantDraft.description
                        }
                        disabled={
                          !editingRestaurant
                        }
                        placeholder="Enter restaurant description"
                        onChange={(event) =>
                          updateRestaurantField(
                            "description",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </label>

                  {editingRestaurant && (
                    <div className="owner-profile-save-wrap">
                      <button
                        type="submit"
                        className="owner-primary-button"
                      >
                        <Save size={16} />
                        Save and Change
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </section>

            {/* ---------- WEEKLY OPENING HOURS ---------- */}

            <section className="owner-content-card owner-extra-card">
              <div className="owner-section-heading">
                <h2>Opening Hours</h2>
              </div>

              <p className="owner-map-note">
                Set the opening and closing time for each day. A
                closing time earlier than the opening time means you
                close after midnight. Leave a day empty if you do not
                want to set it.
              </p>

              <div className="owner-hours-list">
                {schedule.map((entry) => (
                  <div key={entry.day} className="owner-hours-row">
                    <strong>{entry.name}</strong>

                    <input
                      type="time"
                      value={entry.open}
                      disabled={entry.closed}
                      onChange={(event) =>
                        updateScheduleDay(entry.day, {
                          open: event.target.value,
                        })
                      }
                      aria-label={`${entry.name} opening time`}
                    />

                    <span>to</span>

                    <input
                      type="time"
                      value={entry.close}
                      disabled={entry.closed}
                      onChange={(event) =>
                        updateScheduleDay(entry.day, {
                          close: event.target.value,
                        })
                      }
                      aria-label={`${entry.name} closing time`}
                    />

                    <label className="owner-choice">
                      <input
                        type="checkbox"
                        checked={entry.closed}
                        onChange={(event) =>
                          updateScheduleDay(entry.day, {
                            closed: event.target.checked,
                          })
                        }
                      />
                      Closed
                    </label>
                  </div>
                ))}
              </div>

              <div className="owner-profile-save-wrap">
                <button
                  type="button"
                  className="owner-primary-button"
                  onClick={handleSaveSchedule}
                  disabled={isSaving || schedule.length === 0}
                >
                  <Save size={16} />
                  Save Opening Hours
                </button>
              </div>
            </section>

            {/* ---------- OPEN / CLOSED ---------- */}

            <section className="owner-content-card owner-extra-card">
              <div className="owner-section-heading">
                <h2>Availability</h2>
              </div>

              <div className="owner-switch-row">
                <div>
                  <strong>Temporarily Closed</strong>
                  <p>
                    Turn this on in an emergency. Your restaurant shows
                    as closed whatever your opening hours say, and your
                    deals are hidden from customers.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isTemporarilyClosed}
                  aria-label="Temporarily closed"
                  className={`owner-switch ${
                    isTemporarilyClosed ? "on" : ""
                  }`}
                  onClick={handleToggleClosure}
                >
                  <span />
                </button>
              </div>
            </section>

            {/* ---------- MEALS AND OCCASIONS ---------- */}

            <section className="owner-content-card owner-extra-card">
              <div className="owner-section-heading">
                <h2>Meals &amp; Occasions</h2>
              </div>

              <div className="owner-extra-grid">
                <div className="owner-choice-group">
                  <span className="owner-choice-title">
                    Meals you serve
                  </span>

                  <div className="owner-choice-list">
                    {MEAL_CHOICES.map((meal) => (
                      <label key={meal.value} className="owner-choice">
                        <input
                          type="checkbox"
                          checked={mealTypes.includes(meal.value)}
                          onChange={() =>
                            toggleDiningChoice(setMealTypes, meal.value)
                          }
                        />
                        {meal.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="owner-choice-group">
                  <span className="owner-choice-title">
                    Who is it good for
                  </span>

                  <div className="owner-choice-list">
                    {OCCASION_CHOICES.map((occasion) => (
                      <label
                        key={occasion.value}
                        className="owner-choice"
                      >
                        <input
                          type="checkbox"
                          checked={diningOccasions.includes(
                            occasion.value
                          )}
                          onChange={() =>
                            toggleDiningChoice(
                              setDiningOccasions,
                              occasion.value
                            )
                          }
                        />
                        {occasion.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="owner-profile-save-wrap">
                <button
                  type="button"
                  className="owner-primary-button"
                  onClick={handleSaveDining}
                  disabled={isSaving}
                >
                  <Save size={16} />
                  Save Meals &amp; Occasions
                </button>
              </div>
            </section>

            {/* ---------- MAP POSITION ---------- */}

            <section className="owner-content-card owner-extra-card">
              <div className="owner-section-heading">
                <h2>Map Location</h2>
              </div>

              <p className="owner-map-note">
                Type your full address and press the button. Customers
                use it to see your restaurant on the map, find you
                with &quot;Near me&quot; and see how far you are from
                them. You can change it and update it again at any
                time.
              </p>

              <div className="owner-map-example">
                <strong>How to write the address</strong>

                <p>
                  Write it from small to big:{" "}
                  <em>house / road, area, city</em>
                </p>

                <ul>
                  <li>House 12, Road 5, Sector 11, Uttara, Dhaka</li>
                  <li>Zindabazar, Sylhet</li>
                  <li>Lalkhan Bazar, Chattogram</li>
                </ul>

                <p>
                  If the map pin is in the wrong place, remove the
                  house or shop number and keep the road, area and
                  city, then press the button again.
                </p>
              </div>

              <div className="owner-map-controls">
                <input
                  type="text"
                  value={mapAddress ?? defaultMapAddress}
                  onChange={(event) =>
                    setMapAddress(event.target.value)
                  }
                  placeholder="e.g. House 5, Road 2, Sector 11, Uttara, Dhaka"
                  aria-label="Address to find on the map"
                />

                <button
                  type="button"
                  className="owner-secondary-button"
                  onClick={handleLocateRestaurant}
                  disabled={isSaving}
                >
                  <Navigation size={16} />
                  {mapPosition ? "Update on Map" : "Set on Map"}
                </button>
              </div>

              {mapPosition ? (
                <>
                  <div className="owner-map-frame">
                    <iframe
                      title="Restaurant location"
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                        Number(mapPosition.longitude) - 0.008
                      }%2C${Number(mapPosition.latitude) - 0.005}%2C${
                        Number(mapPosition.longitude) + 0.008
                      }%2C${
                        Number(mapPosition.latitude) + 0.005
                      }&layer=mapnik&marker=${mapPosition.latitude}%2C${
                        mapPosition.longitude
                      }`}
                    />
                  </div>

                  <p className="owner-map-note">
                    {Number(mapPosition.latitude).toFixed(5)},{" "}
                    {Number(mapPosition.longitude).toFixed(5)}
                    {mapPosition.place
                      ? ` - ${mapPosition.place}`
                      : ""}
                    {" · "}
                    <a
                      href={`https://www.google.com/maps?q=${mapPosition.latitude},${mapPosition.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  </p>
                </>
              ) : (
                <p className="owner-map-note">
                  Your restaurant is not on the map yet.
                </p>
              )}
            </section>
            </>
          )}

          {/* ================= MANAGE MENU ================= */}

          {activeTab === "menu" && (
            <section className="owner-content-card owner-menu-card-new">
              {/* ADD BUTTON - RIGHT SIDE */}

              <div
                className="owner-menu-top-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  width: "100%",
                  marginBottom: 16,
                }}
              >
                <button
                  type="button"
                  className="owner-secondary-button"
                  onClick={() => setCategoriesOpen(true)}
                >
                  <Menu size={16} />
                  Manage Categories
                </button>

                <button
                  type="button"
                  className="owner-primary-button"
                  onClick={openAddFoodModal}
                >
                  <Plus size={16} />
                  Add New Item
                </button>
              </div>

              {/* FILTER TABS AND SEARCH */}

              <div
                className="owner-menu-toolbar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  flexWrap: "wrap",
                  gap: 15,
                  marginBottom: 18,
                }}
              >
                <div
                  className="owner-menu-tabs"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#d8d8d8",
                    padding: 5,
                    borderRadius: 7,
                  }}
                >
                  {[
                    {
                      id: "all",
                      label: "All Items",
                    },
                    {
                      id: "available",
                      label: "Available",
                    },
                    {
                      id: "unavailable",
                      label: "Not Available",
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setMenuFilter(tab.id)
                      }
                      style={{
                        border: "none",
                        borderRadius: 5,
                        padding: "8px 15px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition:
                          "all 0.2s ease",
                        background:
                          menuFilter === tab.id
                            ? "#a9230c"
                            : "transparent",
                        color:
                          menuFilter === tab.id
                            ? "#ffffff"
                            : "#333333",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div
                  className="owner-menu-search"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    border:
                      "1px solid #d9d9d9",
                    background: "#f8f8f8",
                    borderRadius: 7,
                    padding: "10px 12px",
                    minWidth: 230,
                    maxWidth: 300,
                    flex: "1 1 230px",
                    marginLeft: "auto",
                  }}
                >
                  <Search
                    size={17}
                    color="#999"
                    style={{
                      flexShrink: 0,
                    }}
                  />

                  <input
                    type="search"
                    value={menuSearch}
                    onChange={(event) =>
                      setMenuSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search food name, cuisine or category..."
                    style={{
                      width: "100%",
                      minWidth: 0,
                      border: "none",
                      outline: "none",
                      background:
                        "transparent",
                      fontSize: 12,
                      color: "#333",
                    }}
                  />
                </div>
              </div>

              {/* MENU TABLE */}

              <div className="owner-menu-table-scroll">
                <table className="owner-menu-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Cuisine</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMenu.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="owner-menu-empty"
                        >
                          No food items found.
                        </td>
                      </tr>
                    ) : (
                      filteredMenu.map((food) => (
                        <tr key={food.id}>
                          <td>
                            <div className="owner-menu-thumbnail">
                              {food.image ? (
                                <img
                                  src={food.image}
                                  alt={food.name}
                                />
                              ) : (
                                <ImageIcon
                                  size={22}
                                />
                              )}
                            </div>
                          </td>

                          <td>
                            <strong>
                              {food.name}
                            </strong>
                          </td>

                          <td>
                            {food.cuisine || "-"}
                          </td>

                          <td>
                            {food.category}
                          </td>

                          {/* PRICE */}

                          <td>
                            <div
                              style={{
                                display: "flex",
                                flexDirection:
                                  "column",
                                alignItems:
                                  "flex-start",
                                gap: 5,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: 13,
                                  color: "#252525",
                                }}
                              >
                                ৳
                                {Number(
                                  food.price
                                ).toLocaleString(
                                  "en-BD"
                                )}
                              </strong>

                              {Number(
                                food.oldPrice
                              ) > 0 && (
                                <span
                                  className="owner-menu-old-price"
                                  style={{
                                    display:
                                      "block",
                                    fontSize: 12,
                                    color: "#999",
                                    textDecoration:
                                      "line-through",
                                    lineHeight:
                                      1.3,
                                    margin: 0,
                                  }}
                                >
                                  ৳
                                  {Number(
                                    food.oldPrice
                                  ).toLocaleString(
                                    "en-BD"
                                  )}
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <button
                              type="button"
                              className={`owner-menu-status ${
                                food.available
                                  ? "available"
                                  : "unavailable"
                              }`}
                              onClick={() =>
                                toggleAvailability(
                                  food.id
                                )
                              }
                              title="Click to change availability"
                            >
                              {food.available
                                ? "• Available"
                                : "• Not available"}
                            </button>
                          </td>

                          <td>
                            <div className="owner-menu-table-actions">
                              <button
                                type="button"
                                className="owner-menu-edit"
                                onClick={() =>
                                  openEditFoodModal(
                                    food
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="owner-menu-delete"
                                onClick={() =>
                                  deleteFood(
                                    food.id
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ================= OFFERS ================= */}

          {activeTab === "offers" && (
            <OwnerOffers
              menuItems={menuItems}
              onNotify={showNotification}
            />
          )}

          {/* ================= REVIEWS ================= */}

          {activeTab === "reviews" && (
            <ReviewsSection reviews={reviews} />
          )}
        </main>

        {/* ================= MANAGE CATEGORIES POPUP ================= */}

        {categoriesOpen && (
          <div
            className="owner-food-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setCategoriesOpen(false);
                setRenamingId(null);
              }
            }}
          >
            <div
              className="owner-food-modal owner-category-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="owner-category-modal-title"
            >
              <div className="owner-food-modal-heading">
                <h2 id="owner-category-modal-title">
                  Manage Categories
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setCategoriesOpen(false);
                    setRenamingId(null);
                  }}
                  aria-label="Close popup"
                >
                  <X size={21} />
                </button>
              </div>

              <form
                className="owner-category-add"
                onSubmit={handleAddSection}
              >
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(event) =>
                    setNewSectionName(event.target.value)
                  }
                  placeholder="New category, e.g. Cakes, Burgers, Drinks"
                  maxLength={200}
                  aria-label="New category name"
                />

                <button
                  type="submit"
                  className="owner-primary-button"
                  disabled={isSaving}
                >
                  <Plus size={16} />
                  Add
                </button>
              </form>

              <div className="owner-category-list">
                {menuSections.length === 0 ? (
                  <p className="owner-menu-empty">
                    No categories yet. Add your first one above, then
                    choose it when you add a dish.
                  </p>
                ) : (
                  menuSections.map((section) => (
                    <div
                      key={section.id}
                      className="owner-category-row"
                    >
                      {renamingId === section.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(event) =>
                            setRenameValue(event.target.value)
                          }
                          maxLength={200}
                          autoFocus
                        />
                      ) : (
                        <strong>{section.name}</strong>
                      )}

                      <div className="owner-menu-table-actions">
                        {renamingId === section.id ? (
                          <>
                            <button
                              type="button"
                              className="owner-menu-edit"
                              onClick={() => saveRename(section)}
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              className="owner-offer-pause"
                              onClick={() => setRenamingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="owner-menu-edit"
                              onClick={() => startRenaming(section)}
                            >
                              Rename
                            </button>

                            <button
                              type="button"
                              className="owner-menu-delete"
                              onClick={() => deleteSection(section)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="owner-food-modal-footer">
                <button
                  type="button"
                  className="owner-food-modal-cancel"
                  onClick={() => {
                    setCategoriesOpen(false);
                    setRenamingId(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ADD / EDIT FOOD POPUP ================= */}

        {foodModalOpen && (
          <div
            className="owner-food-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeFoodModal();
              }
            }}
          >
            <div
              className="owner-food-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="owner-food-modal-title"
            >
              <div className="owner-food-modal-heading">
                <h2 id="owner-food-modal-title">
                  {editingFoodId === null
                    ? "Add New Food Item"
                    : "Edit Food Item"}
                </h2>

                <button
                  type="button"
                  onClick={closeFoodModal}
                  aria-label="Close popup"
                >
                  <X size={21} />
                </button>
              </div>

              <form onSubmit={handleSaveFood}>
                <div className="owner-food-modal-layout">
                  {/* FOOD IMAGE */}

                  <div className="owner-food-modal-image-column">
                    <div className="owner-food-modal-image">
                      {foodDraft.image ? (
                        <img
                          src={foodDraft.image}
                          alt="Food preview"
                        />
                      ) : (
                        <ImageIcon
                          size={60}
                        />
                      )}
                    </div>

                    <label className="owner-food-modal-upload">
                      Change Image

                      <input
                        type="file"
                        accept="image/*"
                        onChange={
                          handleFoodImageUpload
                        }
                        hidden
                      />
                    </label>
                  </div>

                  {/* FOOD DETAILS */}

                  <div className="owner-food-modal-fields">
                    <div className="owner-food-modal-two-col">
                      <label>
                        <span>
                          Food Name <em>*</em>
                        </span>

                        <input
                          type="text"
                          value={foodDraft.name}
                          onChange={(event) =>
                            updateFoodField(
                              "name",
                              event.target.value
                            )
                          }
                          placeholder="e.g. Zinger Burger"
                          required
                        />
                      </label>

                      <label>
                        <span>
                          Category <em>*</em>
                        </span>

                        <select
                          value={
                            foodDraft.category
                          }
                          onChange={(event) =>
                            updateFoodField(
                              "category",
                              event.target.value
                            )
                          }
                          required
                        >
                          {foodCategoryOptions.length === 0 && (
                            <option value="">
                              Create a category first
                            </option>
                          )}

                          {foodCategoryOptions.map(
                            (category) => (
                              <option
                                key={category}
                                value={category}
                              >
                                {category}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>

                    <div className="owner-food-modal-two-col">
                      <label>
                        <span>
                          Price (৳) <em>*</em>
                        </span>

                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={foodDraft.price}
                          onChange={(event) =>
                            updateFoodField(
                              "price",
                              event.target.value
                            )
                          }
                          placeholder="250"
                          required
                        />
                      </label>

                      <label>
                        <span>
                          Old Price (৳)
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            foodDraft.oldPrice
                          }
                          onChange={(event) =>
                            updateFoodField(
                              "oldPrice",
                              event.target.value
                            )
                          }
                          placeholder="300"
                        />
                      </label>
                    </div>

                    <label>
                      <span>
                        Description
                      </span>

                      <textarea
                        rows={3}
                        value={
                          foodDraft.description
                        }
                        onChange={(event) =>
                          updateFoodField(
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Describe your food item..."
                      />
                    </label>

                    {[
                      {
                        field: "cuisines",
                        title: "Cuisine",
                        options: cuisineList,
                      },
                      {
                        field: "dietaryTags",
                        title: "Dietary Tags",
                        options: dietaryList,
                      },
                    ].map((group) => (
                      <div
                        key={group.field}
                        className="owner-choice-group"
                      >
                        <span className="owner-choice-title">
                          {group.title}
                        </span>

                        {group.options.length === 0 ? (
                          <p className="owner-choice-empty">
                            No options available yet.
                          </p>
                        ) : (
                          <div className="owner-choice-list">
                            {group.options.map((option) => (
                              <label
                                key={option.id}
                                className="owner-choice"
                              >
                                <input
                                  type="checkbox"
                                  checked={foodDraft[
                                    group.field
                                  ].includes(option.id)}
                                  onChange={() =>
                                    toggleFoodChoice(
                                      group.field,
                                      option.id
                                    )
                                  }
                                />
                                {option.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <fieldset className="owner-food-modal-availability">
                      <legend>
                        Availability
                      </legend>

                      <label>
                        <input
                          type="radio"
                          name="foodAvailability"
                          checked={
                            foodDraft.available
                          }
                          onChange={() =>
                            updateFoodField(
                              "available",
                              true
                            )
                          }
                        />
                        Available
                      </label>

                      <label>
                        <input
                          type="radio"
                          name="foodAvailability"
                          checked={
                            !foodDraft.available
                          }
                          onChange={() =>
                            updateFoodField(
                              "available",
                              false
                            )
                          }
                        />
                        Not available
                      </label>
                    </fieldset>
                  </div>
                </div>

                <div className="owner-food-modal-footer">
                  <button
                    type="button"
                    className="owner-food-modal-cancel"
                    onClick={closeFoodModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="owner-primary-button"
                  >
                    {editingFoodId === null
                      ? "Add Item"
                      : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }