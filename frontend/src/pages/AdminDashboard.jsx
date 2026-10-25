
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import logoIcon from "../Image/logo.png";
import { apiCall, errorMessage, mapBackendUser, saveUser } from "../api";
import "./AdminDashboard.css";

/* ================= LOADING FROM THE BACKEND ================= */

// The filter panels listen for this and load the tag lists again.
const TAGS_UPDATED_EVENT = "nearbite-tags-updated";

// Every page of a paged list (100 rows a page, at most 20 pages). null when it could not be loaded.
async function fetchAll(path) {
  const rows = [];

  for (let page = 1; page <= 20; page += 1) {
    const joint = path.includes("?") ? "&" : "?";

    const { ok, data } = await apiCall(
      `${path}${joint}page=${page}&page_size=100`
    );

    if (!ok) return null;

    rows.push(...data.results);

    if (page >= data.total_pages) break;
  }

  return rows;
}

// A plain (not paged) list.
async function fetchList(path) {
  const { ok, data } = await apiCall(path);

  return ok ? data : null;
}

// Restaurant registrations (pending, approved, declined) as rows for the Restaurants tab.
async function loadRestaurants() {
  const rows = await fetchAll("/api/list_restaurant_request/");

  if (!rows) return null;

  return rows.map((request) => ({
    id: `request-${request.id}`,
    requestId: request.id,
    name: request.restaurant_name,
    ownerName: request.restaurant_owner_name || "",
    email: request.restaurant_email || "",
    phone: request.restaurant_phone || "",
    registrationNumber: request.restaurant_business_reg_id || "",
    city: request.restaurant_city || "",
    area: request.restaurant_area || "",
    address: request.restaurant_location || "",
    declineReason: request.decline_reason || "",
    // the backend says "declined", this page says "rejected"
    status:
      request.status === "declined" ? "rejected" : request.status,
    createdAt: request.created_at,
  }));
}

async function loadUsers() {
  const rows = await fetchAll("/api/list_customer/");

  if (!rows) return null;

  return rows.map((customer) => ({
    id: `customer-${customer.id}`,
    name: customer.customer_name,
    email: customer.customer_email || "",
    phone: customer.customer_phone || "",
    city: customer.customer_city || "",
    area: customer.customer_area || "",
    address: customer.customer_address || "",
    role: "customer",
    // customers sign up without an approval step
    status: "approved",
    createdAt: customer.created_at,
  }));
}

// What customers wrote about a restaurant (reports to the admin).
async function loadReports() {
  const rows = await fetchAll("/api/list_report/");

  if (!rows) return null;

  return rows.map((report) => ({
    id: report.id,
    restaurantId: report.restaurant,
    restaurantName: report.restaurant_name,
    customerName: report.customer_name,
    comment: report.description || "",
    reportStatus: report.status,
    date: report.created_at,
    createdAt: report.created_at,
  }));
}

// Ratings of restaurants and of dishes.
async function loadReviews() {
  const rows = await fetchAll("/api/list_review/");

  if (!rows) return null;

  return rows.map((review) => ({
    id: `${review.type}-${review.id}`,
    // The backend id and kind, to delete it (restaurant and dish reviews have separate ids).
    reviewId: review.id,
    restaurantId: review.restaurant,
    restaurantName: review.restaurant_name,
    customerName: review.customer_name,
    foodName: review.dish_name || "",
    reviewType: review.type === "dish" ? "food" : "restaurant",
    rating: Number(review.rating) || 0,
    comment: review.comment || "",
    date: review.created_at,
    createdAt: review.updated_at || review.created_at,
    flagged: false,
  }));
}

// The approved restaurants (the ones that exist), newest first.
async function loadApprovedRestaurants() {
  const rows = await fetchAll("/api/list_restaurant/");

  if (!rows) return null;

  return rows
    .map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      area: restaurant.area || "",
      city: restaurant.city || "",
      createdAt: restaurant.created_at,
    }))
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt) || 0) -
        (Date.parse(a.createdAt) || 0)
    );
}

async function loadAdminData() {
  const [
    approvedList,
    restaurants,
    users,
    reports,
    reviews,
    stats,
    dietary,
    cuisine,
    category,
  ] = await Promise.all([
    loadApprovedRestaurants(),
    loadRestaurants(),
    loadUsers(),
    loadReports(),
    loadReviews(),
    fetchList("/api/admin_dashboard_stats/"),
    fetchList("/api/list_dietary_tag/"),
    fetchList("/api/list_cuisine/"),
    fetchList("/api/list_food_category/"),
  ]);

  return {
    approvedList,
    restaurants,
    users,
    reports,
    reviews,
    stats,
    tags: { dietary, cuisine, category },
  };
}

// Restaurants shown on one page of "Recent Registration".
const RECENT_PER_PAGE = 10;
const FEEDBACK_PER_PAGE = 10;

// The three tag lists the admin manages, and the backend address of each.
const TAG_TYPES = {
  dietary: {
    title: "Dietary Tags",
    create: "/api/create_dietary_tag/",
    update: (id) => `/api/update_dietary_tag/${id}/`,
    remove: (id) => `/api/delete_dietary_tag/${id}/`,
  },
  cuisine: {
    title: "Cuisine Tags",
    create: "/api/create_cuisine/",
    update: (id) => `/api/update_cuisine/${id}/`,
    remove: (id) => `/api/delete_cuisine/${id}/`,
  },
  category: {
    title: "Category Tags",
    create: "/api/create_food_category/",
    update: (id) => `/api/update_food_category/${id}/`,
    remove: (id) => `/api/delete_food_category/${id}/`,
  },
};

/* ================= HELPERS ================= */

function formatLabel(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReviewCategory(rating) {
  const value = Number(rating) || 0;

  if (value <= 0) return "unrated";
  if (value <= 2) return "negative";
  if (value >= 4) return "positive";

  return "neutral";
}

function getReviewCategoryLabel(category) {
  if (category === "negative") return "Negative Review";
  if (category === "positive") return "Positive Review";
  if (category === "neutral") return "Neutral Review";

  return "Customer Feedback";
}

function formatReviewDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ================= STATUS BADGE ================= */

function StatusBadge({ status = "pending" }) {
  return (
    <span className={`admin-status admin-status-${status}`}>
      {formatLabel(status)}
    </span>
  );
}

/* ================= NAVIGATION ================= */

const navigation = [
  { id: "dashboard", icon: "▦", title: "Dashboard" },
  { id: "restaurants", icon: "♙", title: "Restaurants" },
  { id: "users", icon: "♧", title: "Users" },
  { id: "dietary", icon: "◇", title: "Dietary Tags" },
  { id: "cuisine", icon: "#", title: "Cuisine Tags" },
  { id: "category", icon: "▣", title: "Category Tags" },
  { id: "reports", icon: "▥", title: "Reports" },
  { id: "profile", icon: "☺", title: "My Profile" },
];

/* ================= DETAILS MODAL ================= */

function DetailsModal({
  item,
  type,
  onClose,
  onStatusChange,
  canChangeStatus = false,
}) {
  const isRestaurant = type === "restaurant";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const excludedFields = new Set([
    "id",
    "requestId",
    "createdAt",
    "status",
    "password",
    "confirmPassword",
    "newPassword",
    "oldPassword",
    "passwordHash",
    "photo",
    "profileImage",
    "image",
    "role",
    "type",
    "token",
    "accessToken",
    "refreshToken",
  ]);

  const preferredFields = isRestaurant
    ? [
        "name",
        "ownerName",
        "businessId",
        "email",
        "phone",
        "registrationNumber",
        "cuisine",
        "city",
        "area",
        "address",
        "openingTime",
        "closingTime",
        "description",
        "declineReason",
      ]
    : [
        "name",
        "fullName",
        "email",
        "phone",
        "dateOfBirth",
        "gender",
        "city",
        "area",
        "address",
      ];

  const allFields = [
    ...preferredFields,
    ...Object.keys(item).filter(
      (key) => !preferredFields.includes(key)
    ),
  ];

  const visibleFields = [...new Set(allFields)].filter(
    (key) => {
      if (excludedFields.has(key)) return false;

      if (
        /password|secret|token|credential|auth|otp|pin/i.test(
          key
        )
      ) {
        return false;
      }

      const value = item[key];

      return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        typeof value !== "object"
      );
    }
  );

  const getFieldLabel = (key) => {
    if (key === "name") {
      return isRestaurant
        ? "Restaurant Name"
        : "Customer Name";
    }

    if (key === "ownerName") return "Owner Name";
    if (key === "businessId") return "Business ID";

    if (key === "registrationNumber") {
      return "Registration Number";
    }

    return formatLabel(key);
  };

  return createPortal(
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="admin-details-modal"
        role="dialog"
        aria-modal="true"
        aria-label={
          isRestaurant
            ? "Restaurant registration details"
            : "Customer registration details"
        }
      >
        <div className="admin-modal-header">
          <div>
            <h2>
              {isRestaurant
                ? "Restaurant Registration Details"
                : "Customer Registration Details"}
            </h2>

            <p>
              Review the submitted information before
              approving or rejecting.
            </p>
          </div>

          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div className="admin-modal-profile">
          <div className="admin-modal-avatar">
            {String(
              isRestaurant
                ? item.ownerName || item.name || "R"
                : item.name || "U"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <h3>
              {isRestaurant
                ? item.ownerName || item.name || "Restaurant"
                : item.name || "Customer"}
            </h3>

            <p>
              {isRestaurant
                ? item.ownerName
                  ? item.name || "Restaurant"
                  : item.email || ""
                : item.email || "Customer account"}
            </p>
          </div>

          <StatusBadge status={item.status} />
        </div>

        <div className="admin-modal-body">
          <h3>Signup Information</h3>

          <div className="admin-details-grid">
            {visibleFields.map((key) => (
              <div className="admin-detail-field" key={key}>
                <span>{getFieldLabel(key)}</span>
                <strong>{String(item[key])}</strong>
              </div>
            ))}
          </div>

          {visibleFields.length === 0 && (
            <p className="admin-empty">
              No registration information available.
            </p>
          )}

          <p className="admin-modal-note">
            Only available registration information is
            displayed. Passwords and other credentials
            are never shown.
          </p>
        </div>

        <div className="admin-modal-footer">
          <button
            type="button"
            className="admin-modal-cancel"
            onClick={onClose}
          >
            Close
          </button>

          {canChangeStatus && item.status !== "rejected" && (
            <button
              type="button"
              className="admin-action-reject"
              onClick={() => onStatusChange("rejected")}
            >
              Reject
            </button>
          )}

          {canChangeStatus && item.status !== "approved" && (
            <button
              type="button"
              className="admin-action-approve"
              onClick={() => onStatusChange("approved")}
            >
              Approve
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

/* ================= RESTAURANT PROFILE AND MENU POPUP ================= */

function RestaurantViewModal({ restaurant, onClose }) {
  // { id, details, menu } of the restaurant that was loaded last
  const [loaded, setLoaded] = useState({ id: null });

  useEffect(() => {
    let active = true;

    Promise.all([
      apiCall(`/api/view_restaurant_details/${restaurant.id}/`),
      apiCall(`/api/browse_menu/${restaurant.id}/`),
    ]).then(([detailsResult, menuResult]) => {
      if (!active) return;

      setLoaded({
        id: restaurant.id,
        details: detailsResult.ok ? detailsResult.data : null,
        menu: menuResult.ok ? menuResult.data : null,
      });
    });

    return () => {
      active = false;
    };
  }, [restaurant.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const isLoading = loaded.id !== restaurant.id;
  const { details, menu } = loaded;

  // The menu as groups: each of the restaurant's sections, then the dishes without one.
  const groups = menu
    ? [
        ...menu.categories.map((category) => ({
          key: category.id,
          name: category.name,
          items: category.items,
        })),
        ...(menu.uncategorized.length
          ? [
              {
                key: "other",
                name: "Other",
                items: menu.uncategorized,
              },
            ]
          : []),
      ]
    : [];

  const fields = details
    ? [
        ["Restaurant Name", details.name],
        [
          "Cuisines",
          details.cuisines.map((item) => item.name).join(", "),
        ],
        ["Address", details.address.full],
        ["Phone", details.contact.phone],
        [
          "Status",
          details.status.is_temporarily_closed
            ? "Temporarily closed"
            : formatLabel(details.status.opening_status),
        ],
        [
          "Rating",
          details.rating != null
            ? `${details.rating} (${details.rating_count})`
            : "No ratings yet",
        ],
        ["Dishes", details.dish_count],
      ].filter(
        ([, value]) =>
          value !== null && value !== undefined && value !== ""
      )
    : [];

  return createPortal(
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="admin-details-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Restaurant profile and menu"
      >
        <div className="admin-modal-header">
          <div>
            <h2>Restaurant Profile & Menu</h2>

            <p>{restaurant.name}</p>
          </div>

          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="admin-modal-body">
          {isLoading && (
            <p className="admin-empty">Loading...</p>
          )}

          {!isLoading && !details && (
            <p className="admin-empty">
              Could not load this restaurant.
            </p>
          )}

          {details && (
            <>
              <h3>Profile</h3>

              <div className="admin-details-grid">
                {fields.map(([label, value]) => (
                  <div className="admin-detail-field" key={label}>
                    <span>{label}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>

              {details.description && (
                <p className="admin-modal-note">
                  {details.description}
                </p>
              )}

              <h3 className="admin-menu-heading">Menu</h3>

              {groups.length === 0 && (
                <p className="admin-empty">
                  No dishes on the menu yet.
                </p>
              )}

              {groups.map((group) => (
                <div className="admin-menu-group" key={group.key}>
                  <h4>{group.name}</h4>

                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Dish</th>
                        <th>Price</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.items.map((dish) => (
                        <tr key={dish.id}>
                          <td>
                            <strong>{dish.name}</strong>
                          </td>

                          <td>
                            {dish.final_price != null
                              ? `৳${dish.final_price}`
                              : "-"}
                          </td>

                          <td>
                            {dish.is_available
                              ? "Available"
                              : "Not available"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="admin-modal-footer">
          <button
            type="button"
            className="admin-modal-cancel"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

/* ================= MAIN DASHBOARD ================= */

export default function AdminDashboard({
  user = null,
  onLogout,
  onLogoutClick,
}) {
  /* ================= STATES ================= */

  const [activeTab, setActiveTab] = useState("dashboard");

  // Everything below comes from the backend.
  const [restaurants, setRestaurants] = useState([]);

  // The approved restaurants shown in "Recent Registration": { id, name, area, city, createdAt }
  const [approvedList, setApprovedList] = useState([]);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentPage, setRecentPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);

  // The tag being renamed: { type, id } and the name typed so far.
  const [editingTag, setEditingTag] = useState(null);
  const [editTagValue, setEditTagValue] = useState("");

  // The admin's own profile form.
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    confirm: "",
  });
  const [profileMessage, setProfileMessage] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // The restaurant whose profile and menu are open in the popup
  const [viewRestaurant, setViewRestaurant] = useState(null);

  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);

  // Tag lists: [{ id, name, menu_item_count }]
  const [tagLists, setTagLists] = useState({
    dietary: [],
    cuisine: [],
    category: [],
  });

  const [loadFailed, setLoadFailed] = useState(false);

  const [newTag, setNewTag] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewTypeFilter, setReviewTypeFilter] =
    useState("all");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDetails, setSelectedDetails] =
    useState(null);
  const [openActionMenu, setOpenActionMenu] =
    useState(null);

  /* ================= LOAD DATA ================= */

  // Puts what the backend answered into the page (a list that failed to load stays as it was).
  const applyData = useCallback((data) => {
    if (data.approvedList) setApprovedList(data.approvedList);
    if (data.restaurants) setRestaurants(data.restaurants);
    if (data.users) setUsers(data.users);
    if (data.reports) setReports(data.reports);
    if (data.reviews) setReviews(data.reviews);
    if (data.stats) setStats(data.stats);

    setTagLists((previous) => ({
      dietary: data.tags.dietary ?? previous.dietary,
      cuisine: data.tags.cuisine ?? previous.cuisine,
      category: data.tags.category ?? previous.category,
    }));

    setLoadFailed(!data.stats);
  }, []);

  // Load again (after the admin changed something).
  const refresh = useCallback(
    () => loadAdminData().then(applyData),
    [applyData]
  );

  useEffect(() => {
    let active = true;

    loadAdminData().then((data) => {
      if (active) applyData(data);
    });

    return () => {
      active = false;
    };
  }, [applyData]);

  /* ================= MY PROFILE: LOAD ================= */

  const adminId = user?.id;

  useEffect(() => {
    if (activeTab !== "profile" || !adminId) return undefined;

    let active = true;

    apiCall(`/api/view_admin_profile/${adminId}/`).then(
      ({ ok, data }) => {
        if (!active || !ok) return;

        setProfileForm((previous) => ({
          ...previous,
          name: data.admin_name || "",
          email: data.admin_email || "",
        }));
      }
    );

    return () => {
      active = false;
    };
  }, [activeTab, adminId]);

  /* ================= ESCAPE CLOSE ================= */

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedDetails(null);
        setOpenActionMenu(null);
        setViewRestaurant(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  /* ================= REVIEW DATA ================= */

  const reviewReports = useMemo(() => {
    return reviews.map((review) => ({
      ...review,
      reportId: `review-${review.id}`,
      type: "review",
      category: getReviewCategory(review.rating),
    }));
  }, [reviews]);

  const manualReports = useMemo(() => {
    return reports.map((report) => ({
      ...report,
      reportId: `manual-${report.id}`,
      type: "report",
      foodName: "",
      rating: 0,
      category: "reported",
    }));
  }, [reports]);

  const combinedReports = useMemo(() => {
    return [...reviewReports, ...manualReports].sort(
      (a, b) => {
        const dateA =
          Date.parse(a.createdAt || a.date) || 0;

        const dateB =
          Date.parse(b.createdAt || b.date) || 0;

        return dateB - dateA;
      }
    );
  }, [reviewReports, manualReports]);

  /* ================= REVIEW STATISTICS ================= */

  const reviewStats = useMemo(() => {
    const total = reviews.length;

    const positive = reviews.filter(
      (review) =>
        getReviewCategory(review.rating) === "positive"
    ).length;

    const negative = reviews.filter(
      (review) =>
        getReviewCategory(review.rating) === "negative"
    ).length;

    const neutral = reviews.filter(
      (review) =>
        getReviewCategory(review.rating) === "neutral"
    ).length;

    const foodReviews = reviews.filter(
      (review) => review.reviewType === "food"
    ).length;

    const restaurantReviews = reviews.filter(
      (review) => review.reviewType !== "food"
    ).length;

    const totalRating = reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );

    const averageRating =
      total > 0
        ? (totalRating / total).toFixed(1)
        : "0.0";

    return {
      total,
      positive,
      negative,
      neutral,
      foodReviews,
      restaurantReviews,
      averageRating,
    };
  }, [reviews]);

  /* ================= REGISTRATION COUNTS ================= */

  // The totals come from the backend (they count everything, not just what is listed).
  const approvedRestaurants =
    stats?.total_restaurants ?? 0;

  const pendingRestaurants =
    stats?.pending_restaurant_requests ?? 0;

  const approvedUsers = stats?.total_customers ?? 0;

  // Customers do not wait for approval.
  const pendingUsers = 0;

  const pendingTotal =
    pendingRestaurants + pendingUsers;

  /* ================= FILTERING ================= */

  const filteredRestaurants = restaurants.filter(
    (item) => {
      const searchableText = [
        item.name,
        item.businessId,
        item.email,
        item.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(
        search.toLowerCase()
      );

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    }
  );

  const filteredUsers = users.filter((item) => {
    const searchableText = [
      item.name,
      item.email,
      item.phone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(
      search.toLowerCase()
    );

    const matchesStatus =
      statusFilter === "all" ||
      item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // A new search or filter starts feedback again from page 1.
  const feedbackFilterKey = `${search}|${reviewFilter}|${reviewTypeFilter}`;
  const [seenFeedbackKey, setSeenFeedbackKey] = useState(feedbackFilterKey);

  if (seenFeedbackKey !== feedbackFilterKey) {
    setSeenFeedbackKey(feedbackFilterKey);
    setFeedbackPage(1);
  }

  const filteredReports = combinedReports.filter(
    (item) => {
      const searchableText = [
        item.restaurantName,
        item.customerName,
        item.foodName,
        item.comment,
        item.rating,
        item.date,
      ]
        .filter(
          (value) =>
            value !== null && value !== undefined
        )
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(
        search.toLowerCase()
      );

      const matchesRating =
        reviewFilter === "all" ||
        (reviewFilter === "reported" &&
          item.type === "report") ||
        (reviewFilter !== "reported" &&
          item.type === "review" &&
          item.category === reviewFilter);

      const matchesType =
        reviewTypeFilter === "all" ||
        (reviewTypeFilter === "food" &&
          item.type === "review" &&
          item.reviewType === "food") ||
        (reviewTypeFilter === "restaurant" &&
          item.type === "review" &&
          item.reviewType !== "food") ||
        (reviewTypeFilter === "report" &&
          item.type === "report");

      return (
        matchesSearch &&
        matchesRating &&
        matchesType
      );
    }
  );

  /* ================= NAVIGATION ================= */

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setStatusFilter("all");
    setReviewFilter("all");
    setReviewTypeFilter("all");
    setNewTag("");
    setSidebarOpen(false);
    setOpenActionMenu(null);
    setSelectedDetails(null);

    // Show the newest reviews and reports when the tab opens.
    if (tab === "reports") refresh();
  };

  /* ================= APPROVE / REJECT ================= */

  // Approve or decline a restaurant's registration request.
  // The backend sends the owner an email and, on approval, creates the restaurant and its login.
  const updateRestaurantStatus = async (item, status) => {
    const body =
      status === "approved"
        ? { action: "approve" }
        : { action: "decline" };

    if (status !== "approved") {
      // The restaurant is told why, so a reason is required.
      const reason = window.prompt(
        `Why is ${item.name} being rejected? The restaurant will be told.`
      );

      if (!reason || !reason.trim()) return;

      body.reason = reason.trim();
    }

    const { ok, data } = await apiCall(
      `/api/process_restaurant_request/${item.requestId}/`,
      { method: "POST", body }
    );

    if (!ok) {
      window.alert(errorMessage(data));
    }

    setOpenActionMenu(null);
    setSelectedDetails(null);

    refresh();
  };

  const changeItemStatus = (item, type, status) => {
    // Customers are not approved or rejected.
    if (type !== "restaurant") return;

    const action =
      status === "approved" ? "approve" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${
        item.name || "this restaurant"
      }?`
    );

    if (!confirmed) return;

    updateRestaurantStatus(item, status);
  };

  /* ================= VIEW DETAILS ================= */

  const openDetails = (item, type) => {
    setSelectedDetails({ item, type });
    setOpenActionMenu(null);
  };

  /* ================= ACTION BUTTONS ================= */

  const renderActions = (item, type) => {
    const menuKey = `${type}-${item.id}`;
    const isOpen = openActionMenu === menuKey;

    // Only a restaurant waiting for a decision can be approved or rejected.
    const canDecide =
      type === "restaurant" && item.status === "pending";

    return (
      <div className="admin-row-actions">
        <button
          type="button"
          className="admin-view-button"
          onClick={() => openDetails(item, type)}
        >
          View
        </button>

        {canDecide && (
          <div className="admin-more-wrapper">
            <button
              type="button"
              className={`admin-more-button ${
                isOpen ? "active" : ""
              }`}
              aria-label={`More actions for ${item.name}`}
              aria-expanded={isOpen}
              onClick={() =>
                setOpenActionMenu(
                  isOpen ? null : menuKey
                )
              }
            >
              ⋮
            </button>

            {isOpen && (
              <div className="admin-more-menu">
                <button
                  type="button"
                  className="admin-more-approve"
                  onClick={() =>
                    changeItemStatus(
                      item,
                      type,
                      "approved"
                    )
                  }
                >
                  ✓ Approve
                </button>

                <button
                  type="button"
                  className="admin-more-reject"
                  onClick={() =>
                    changeItemStatus(
                      item,
                      type,
                      "rejected"
                    )
                  }
                >
                  ✕ Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ================= TAG ACTIONS ================= */

  // The filter panels on the website load the lists again.
  const announceTagChange = () => {
    window.dispatchEvent(new CustomEvent(TAGS_UPDATED_EVENT));
  };

  const addTag = async (type) => {
    const value = newTag
      .trim()
      .replace(/\s+/g, " ");

    if (!value) return;

    const alreadyExists = tagLists[type].some(
      (tag) =>
        tag.name.toLowerCase() === value.toLowerCase()
    );

    if (alreadyExists) {
      window.alert("This tag already exists.");
      return;
    }

    const { ok, data } = await apiCall(
      TAG_TYPES[type].create,
      { method: "POST", body: { name: value } }
    );

    if (!ok) {
      window.alert(errorMessage(data));
      return;
    }

    setNewTag("");

    await refresh();
    announceTagChange();
  };

  const removeTag = async (type, tag) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${tag.name}"?`
    );

    if (!confirmed) return;

    const { ok, data } = await apiCall(
      TAG_TYPES[type].remove(tag.id),
      { method: "DELETE" }
    );

    // A tag that dishes still use cannot be removed: the backend says so.
    if (!ok) {
      window.alert(errorMessage(data));
      return;
    }

    await refresh();
    announceTagChange();
  };

  /* ================= TAGS: RENAME ================= */

  const startEditTag = (type, tag) => {
    setEditingTag({ type, id: tag.id });
    setEditTagValue(tag.name);
  };

  const saveTagName = async (type, tag) => {
    const name = editTagValue.trim();

    if (!name) {
      window.alert("Tag name cannot be empty.");
      return;
    }

    if (name !== tag.name) {
      const { ok, data } = await apiCall(
        TAG_TYPES[type].update(tag.id),
        { method: "PUT", body: { name } }
      );

      if (!ok) {
        window.alert(errorMessage(data));
        return;
      }

      await refresh();
      announceTagChange();
    }

    setEditingTag(null);
  };

  /* ================= MY PROFILE: SAVE ================= */

  const updateProfileField = (field, value) => {
    setProfileForm((previous) => ({ ...previous, [field]: value }));
    setProfileMessage(null);
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    if (isSavingProfile) return;

    const name = profileForm.name.trim();
    const email = profileForm.email.trim();

    if (!name) {
      setProfileMessage({ error: true, text: "Name cannot be empty." });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileMessage({ error: true, text: "Please enter a valid email." });
      return;
    }

    if (profileForm.password || profileForm.confirm) {
      if (profileForm.password.length < 6) {
        setProfileMessage({
          error: true,
          text: "Password must be at least 6 characters.",
        });
        return;
      }

      if (profileForm.password !== profileForm.confirm) {
        setProfileMessage({
          error: true,
          text: "Password and Confirm Password do not match.",
        });
        return;
      }
    }

    const body = { admin_name: name, admin_email: email };

    if (profileForm.password) body.admin_password = profileForm.password;

    setIsSavingProfile(true);

    const { ok, data } = await apiCall(
      `/api/update_admin_profile/${adminId}/`,
      { method: "PUT", body }
    );

    setIsSavingProfile(false);

    if (!ok) {
      setProfileMessage({ error: true, text: errorMessage(data) });
      return;
    }

    // A reload shows the new name too.
    saveUser(mapBackendUser("admin", data));

    setProfileForm({
      name: data.admin_name || "",
      email: data.admin_email || "",
      password: "",
      confirm: "",
    });

    setProfileMessage({
      error: false,
      text: profileForm.password
        ? "Profile saved. Your password has been changed."
        : "Profile saved successfully.",
    });
  };

  /* ================= REPORTS AND REVIEWS: STATUS AND DELETE ================= */

  const changeReportStatus = async (item, nextStatus) => {
    const { ok, data } = await apiCall(
      `/api/update_report_status/${item.id}/`,
      { method: "PUT", body: { status: nextStatus } }
    );

    if (!ok) {
      window.alert(errorMessage(data));
      return;
    }

    await refresh();
  };

  const deleteReport = async (item) => {
    if (
      !window.confirm(
        `Delete this report about ${item.restaurantName}? This cannot be undone.`
      )
    ) {
      return;
    }

    const { ok, data } = await apiCall(
      `/api/delete_report/${item.id}/`,
      { method: "DELETE" }
    );

    if (!ok) {
      window.alert(errorMessage(data));
      return;
    }

    await refresh();
  };

  // The review is deleted at once and the customer gets an email saying it did not follow the community guidelines.
  const deleteReview = async (item) => {
    if (
      !window.confirm(
        `Delete ${item.customerName}'s review of ${item.restaurantName}?\n\nIt is deleted at once, and the customer gets an email saying it did not follow the community guidelines.`
      )
    ) {
      return;
    }

    const path =
      item.reviewType === "food"
        ? `/api/delete_dish_review_by_admin/${item.reviewId}/`
        : `/api/delete_review_by_admin/${item.reviewId}/`;

    const { ok, data } = await apiCall(path, { method: "DELETE" });

    if (!ok) {
      window.alert(errorMessage(data));
      return;
    }

    await refresh();
  };

  /* ================= LOGOUT ================= */

  const logout = () => {
    if (typeof onLogout === "function") {
      onLogout();
    } else {
      onLogoutClick?.();
    }
  };

  /* ================= DASHBOARD TAB ================= */

  const renderDashboard = () => {
    // The approved restaurants matching the search, 10 to a page.
    const searchText = recentSearch.trim().toLowerCase();

    const matching = approvedList.filter((item) =>
      item.name.toLowerCase().includes(searchText)
    );

    const recentPages = Math.max(
      1,
      Math.ceil(matching.length / RECENT_PER_PAGE)
    );

    const currentRecentPage = Math.min(recentPage, recentPages);

    const firstRow = (currentRecentPage - 1) * RECENT_PER_PAGE;

    const recent = matching.slice(
      firstRow,
      firstRow + RECENT_PER_PAGE
    );

    return (
      <>
        <div className="admin-heading">
          <h1>Admin Dashboard</h1>
          <p>Overview of the platform</p>

          {loadFailed && (
            <p className="admin-empty">
              Could not load the data from the server.
            </p>
          )}
        </div>

        <div className="admin-stats">
          <div className="admin-stat-card">
            <span>🏬 Restaurant</span>
            <strong>{approvedRestaurants}</strong>
          </div>

          <div className="admin-stat-card">
            <span>🕒 Pending Registrations</span>
            <strong>{pendingTotal}</strong>
            <small>
              {pendingRestaurants} restaurants ·{" "}
              {pendingUsers} users
            </small>
          </div>

          <div className="admin-stat-card">
            <span>👥 Users</span>
            <strong>{approvedUsers}</strong>
          </div>

          <div className="admin-stat-card">
            <span>📊 Reports / Reviews</span>
            <strong>{combinedReports.length}</strong>
          </div>
        </div>

        <section className="admin-beige-panel admin-recent-panel">
          <h2>Recent Registration</h2>

          <input
            type="search"
            className="admin-recent-search"
            placeholder="Search restaurant by name..."
            aria-label="Search restaurant by name"
            value={recentSearch}
            onChange={(event) => {
              setRecentSearch(event.target.value);
              setRecentPage(1);
            }}
          />

          <div className="admin-recent-list">
            {recent.map((item) => (
              <div
                className="admin-recent-row"
                key={item.id}
              >
                <div>
                  <strong>{item.name}</strong>

                  {item.area && <span> ({item.area})</span>}
                </div>

                <button
                  type="button"
                  className="admin-view-button"
                  onClick={() => setViewRestaurant(item)}
                >
                  View
                </button>
              </div>
            ))}

            {recent.length === 0 && (
              <p className="admin-table-empty">
                No restaurants found.
              </p>
            )}
          </div>

          {matching.length > 0 && (
            <div className="admin-recent-pagination">
              <span>
                Showing {firstRow + 1}-
                {Math.min(
                  firstRow + RECENT_PER_PAGE,
                  matching.length
                )}{" "}
                of {matching.length}
              </span>

              <div>
                <button
                  type="button"
                  aria-label="Previous restaurants"
                  disabled={currentRecentPage === 1}
                  onClick={() =>
                    setRecentPage(currentRecentPage - 1)
                  }
                >
                  ‹
                </button>

                <span>
                  {currentRecentPage} / {recentPages}
                </span>

                <button
                  type="button"
                  aria-label="Next restaurants"
                  disabled={currentRecentPage === recentPages}
                  onClick={() =>
                    setRecentPage(currentRecentPage + 1)
                  }
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </section>
      </>
    );
  };

  /* ================= SHARED STATUS FILTER ================= */

  const renderStatusFilter = () => (
    <select
      value={statusFilter}
      onChange={(event) =>
        setStatusFilter(event.target.value)
      }
    >
      <option value="all">All Status</option>
      <option value="approved">Approved</option>
      <option value="pending">Pending</option>
      <option value="rejected">Rejected</option>
    </select>
  );

  /* ================= RESTAURANTS TAB ================= */

  const renderRestaurants = () => (
    <>
      <div className="admin-heading">
        <h1>Restaurants</h1>
        <p>
          Review restaurant registrations and manage
          approvals
        </p>
      </div>

      <section className="admin-beige-panel">
        <div className="admin-toolbar">
          <input
            type="search"
            placeholder="Search restaurants or emails..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          {renderStatusFilter()}
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table admin-management-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRestaurants.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>

                  <td>{item.email || "—"}</td>

                  <td>
                    <StatusBadge status={item.status} />
                  </td>

                  <td>
                    {renderActions(
                      item,
                      "restaurant"
                    )}
                  </td>
                </tr>
              ))}

              {!filteredRestaurants.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="admin-table-empty"
                  >
                    No restaurants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  /* ================= USERS TAB ================= */

  const renderUsers = () => (
    <>
      <div className="admin-heading">
        <h1>Users</h1>
        <p>
          Review customer registrations and manage
          approvals
        </p>
      </div>

      <section className="admin-beige-panel">
        <div className="admin-toolbar">
          <input
            type="search"
            placeholder="Search users..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </div>

        <div className="admin-table-scroll">
          <table className="admin-table admin-management-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>

                  <td>{item.email || "—"}</td>

                  <td>
                    {renderActions(item, "user")}
                  </td>
                </tr>
              ))}

              {!filteredUsers.length && (
                <tr>
                  <td
                    colSpan={3}
                    className="admin-table-empty"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  /* ================= TAGS TAB ================= */

  const renderTags = (type) => {
    const tags = tagLists[type];

    const title = TAG_TYPES[type].title;

    return (
      <>
        <div className="admin-heading">
          <h1>{title}</h1>
          <p>
            Manage available {title.toLowerCase()}
          </p>
        </div>

        <section className="admin-beige-panel">
          <form
            className="admin-tag-form"
            onSubmit={(event) => {
              event.preventDefault();
              addTag(type);
            }}
          >
            <input
              type="text"
              placeholder={`Enter new ${type} tag`}
              value={newTag}
              onChange={(event) =>
                setNewTag(event.target.value)
              }
              maxLength={50}
            />

            <button type="submit">
              + Add Tag
            </button>
          </form>

          <div className="admin-tag-list">
            {tags.map((tag) => (
              <div
                className="admin-tag"
                key={tag.id}
              >
                {editingTag?.type === type &&
                editingTag?.id === tag.id ? (
                  <>
                    <input
                      type="text"
                      className="admin-tag-edit"
                      value={editTagValue}
                      onChange={(event) =>
                        setEditTagValue(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveTagName(type, tag);
                        }

                        if (event.key === "Escape") {
                          setEditingTag(null);
                        }
                      }}
                      maxLength={50}
                      autoFocus
                    />

                    <button
                      type="button"
                      onClick={() => saveTagName(type, tag)}
                      aria-label={`Save ${tag.name}`}
                      title="Save"
                    >
                      ✓
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingTag(null)}
                      aria-label="Cancel"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span>{tag.name}</span>

                    <button
                      type="button"
                      onClick={() => startEditTag(type, tag)}
                      aria-label={`Rename ${tag.name}`}
                      title={`Rename ${tag.name}`}
                    >
                      ✎
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        removeTag(type, tag)
                      }
                      aria-label={`Remove ${tag.name}`}
                      title={`Remove ${tag.name}`}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}

            {tags.length === 0 && (
              <p className="admin-empty">
                No tags available. Add a new tag
                above.
              </p>
            )}
          </div>
        </section>
      </>
    );
  };

  /* ================= MY PROFILE TAB ================= */

  const renderProfile = () => (
    <>
      <div className="admin-heading">
        <h1>My Profile</h1>
        <p>Change your name, email or password</p>
      </div>

      <section className="admin-beige-panel">
        <form className="admin-profile-form" onSubmit={saveProfile}>
          <label>
            Name
            <input
              type="text"
              value={profileForm.name}
              onChange={(event) =>
                updateProfileField("name", event.target.value)
              }
              maxLength={100}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={profileForm.email}
              onChange={(event) =>
                updateProfileField("email", event.target.value)
              }
              maxLength={100}
            />
          </label>

          <label>
            New Password (leave empty to keep the current one)
            <input
              type="password"
              value={profileForm.password}
              onChange={(event) =>
                updateProfileField("password", event.target.value)
              }
              autoComplete="new-password"
            />
          </label>

          <label>
            Confirm Password
            <input
              type="password"
              value={profileForm.confirm}
              onChange={(event) =>
                updateProfileField("confirm", event.target.value)
              }
              autoComplete="new-password"
            />
          </label>

          {profileMessage && (
            <p
              className={
                profileMessage.error
                  ? "admin-profile-error"
                  : "admin-profile-ok"
              }
              role="status"
            >
              {profileMessage.text}
            </p>
          )}

          <button type="submit" disabled={isSavingProfile}>
            {isSavingProfile ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>
    </>
  );

  /* ================= REPORTS & REVIEWS TAB ================= */

  const feedbackPages = Math.max(
    1,
    Math.ceil(filteredReports.length / FEEDBACK_PER_PAGE)
  );

  const currentFeedbackPage = Math.min(
    feedbackPage,
    feedbackPages
  );

  const feedbackFirstRow =
    (currentFeedbackPage - 1) * FEEDBACK_PER_PAGE;

  const pagedReports = filteredReports.slice(
    feedbackFirstRow,
    feedbackFirstRow + FEEDBACK_PER_PAGE
  );

  const renderReports = () => (
    <>
      <div className="admin-heading">
        <h1>Reports & Reviews</h1>
        <p>
          Monitor customer feedback, restaurant ratings,
          food reviews and potential restaurant issues
        </p>
      </div>

      {/* ================= SUMMARY CARDS ================= */}

      <div className="admin-report-summary">
        <div className="admin-mini-stat">
          <span>Total Feedback</span>
          <strong>{combinedReports.length}</strong>
        </div>

        <div className="admin-mini-stat">
          <span>Positive Reviews (4–5 ★)</span>
          <strong>{reviewStats.positive}</strong>
        </div>

        <div className="admin-mini-stat">
          <span>Negative Reviews (0.5–2 ★)</span>
          <strong>{reviewStats.negative}</strong>
        </div>

        <div className="admin-mini-stat">
          <span>Flagged Reports</span>
          <strong>
            {reports.length +
              reviews.filter(
                (review) => review.flagged
              ).length}
          </strong>
        </div>
      </div>

      {/* ================= ADDITIONAL STATS ================= */}

      <div
        className="admin-report-summary"
        style={{ marginTop: "14px" }}
      >
        <div className="admin-mini-stat">
          <span>Average Customer Rating</span>
          <strong>
            ★ {reviewStats.averageRating}
          </strong>
        </div>

        <div className="admin-mini-stat">
          <span>Restaurant Reviews</span>
          <strong>
            {reviewStats.restaurantReviews}
          </strong>
        </div>

        <div className="admin-mini-stat">
          <span>Food Reviews</span>
          <strong>
            {reviewStats.foodReviews}
          </strong>
        </div>

        <div className="admin-mini-stat">
          <span>Neutral Reviews (2.5–3.5 ★)</span>
          <strong>{reviewStats.neutral}</strong>
        </div>
      </div>

      {/* ================= FEEDBACK LIST ================= */}

      <section
        className="admin-beige-panel"
        style={{ marginTop: "22px" }}
      >
        <div className="admin-toolbar">
          <h2>Customer Feedback</h2>

          <input
            type="search"
            placeholder="Search restaurant, food, customer or review..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        {/* ================= FILTERS ================= */}

        <div
          className="admin-toolbar"
          style={{
            marginTop: "12px",
            marginBottom: "18px",
            flexWrap: "wrap",
          }}
        >
          <select
            value={reviewFilter}
            onChange={(event) =>
              setReviewFilter(event.target.value)
            }
            aria-label="Filter by rating"
          >
            <option value="all">
              All Feedback
            </option>
            <option value="positive">
              Positive Reviews (4–5 ★)
            </option>
            <option value="neutral">
              Neutral Reviews (2.5–3.5 ★)
            </option>
            <option value="negative">
              Negative Reviews (0.5–2 ★)
            </option>
            <option value="reported">
              Reported Issues
            </option>
          </select>

          <select
            value={reviewTypeFilter}
            onChange={(event) =>
              setReviewTypeFilter(
                event.target.value
              )
            }
            aria-label="Filter by feedback type"
          >
            <option value="all">
              All Types
            </option>
            <option value="restaurant">
              Restaurant Reviews
            </option>
            <option value="food">
              Food Reviews
            </option>
            <option value="report">
              Reports
            </option>
          </select>

          <span
            style={{
              fontSize: "13px",
              color: "#777",
              marginLeft: "auto",
            }}
          >
            Showing {filteredReports.length} of{" "}
            {combinedReports.length}
          </span>
        </div>

        {/* ================= REVIEW ITEMS ================= */}

        <div className="admin-report-list">
          {pagedReports.map((item) => {
            const isReview = item.type === "review";
            const isNegative =
              item.category === "negative";

            const isPositive =
              item.category === "positive";

            const isNeutral =
              item.category === "neutral";

            const isFoodReview =
              isReview &&
              item.reviewType === "food";

            return (
              <article
                key={item.reportId}
                className={`admin-report-item ${
                  isNegative
                    ? "admin-negative"
                    : ""
                }`}
                style={{
                  borderLeft: isNegative
                    ? "4px solid #dc3545"
                    : isPositive
                    ? "4px solid #28a745"
                    : isNeutral
                    ? "4px solid #d5a32c"
                    : "4px solid #d97736",
                }}
              >
                {/* ---------- RESTAURANT / RATING ---------- */}

                <div className="admin-report-top">
                  <div>
                    <strong>
                      {item.restaurantName}
                    </strong>

                    {item.foodName && (
                      <span className="admin-report-food">
                        {" "}· {item.foodName}
                      </span>
                    )}

                    {isFoodReview && (
                      <span
                        style={{
                          display: "inline-block",
                          marginLeft: "9px",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "12px",
                          background: "#fff0e6",
                          color: "#b35b20",
                        }}
                      >
                        Food Review
                      </span>
                    )}
                  </div>

                  {isReview && (
                    <span className="admin-report-stars">
                      ★ {Number(
                        item.rating || 0
                      ).toFixed(1)}
                    </span>
                  )}
                </div>

                {/* ---------- COMMENT ---------- */}

                <p
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.comment ||
                    (isReview
                      ? "Rating submitted without a written comment."
                      : "No comment provided.")}
                </p>

                {/* ---------- CUSTOMER / DATE / TYPE ---------- */}

                <div className="admin-report-bottom">
                  <span>
                    By{" "}
                    {item.customerName ||
                      "Customer"}

                    {item.date
                      ? ` · ${formatReviewDate(
                          item.date
                        )}`
                      : ""}
                  </span>

                  <span
                    className={
                      isNegative
                        ? "admin-report-warning"
                        : "admin-report-normal"
                    }
                    style={
                      isPositive
                        ? {
                            color: "#20834b",
                            background: "#e7f6eb",
                          }
                        : isNeutral
                        ? {
                            color: "#956b11",
                            background: "#fff4d7",
                          }
                        : undefined
                    }
                  >
                    {isReview
                      ? getReviewCategoryLabel(
                          item.category
                        )
                      : `Reported · ${formatLabel(
                          item.reportStatus
                        )}`}
                  </span>
                </div>

                {/* ---------- REVIEW DETAILS ---------- */}

                {isReview && (
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                      fontSize: "12px",
                      color: "#777",
                    }}
                  >
                    <span>
                      Type:{" "}
                      {isFoodReview
                        ? "Food Rating"
                        : "Restaurant Rating"}
                    </span>

                    <span>
                      Rating:{" "}
                      {Number(
                        item.rating
                      ).toFixed(1)}{" "}
                      / 5.0
                    </span>

                    {item.flagged && (
                      <span
                        style={{
                          color: "#c62828",
                          fontWeight: 700,
                        }}
                      >
                        ⚑ Flagged
                      </span>
                    )}
                  </div>
                )}

                {/* ---------- MANAGE RESTAURANT ---------- */}

                {item.restaurantId && (
                  <button
                    type="button"
                    className="admin-report-manage"
                    onClick={() => {
                      changeTab("restaurants");

                      const matchingRestaurant =
                        restaurants.find(
                          (restaurant) =>
                            String(
                              restaurant.id
                            ) ===
                              String(
                                item.restaurantId
                              ) ||
                            String(
                              restaurant.name
                            ).toLowerCase() ===
                              String(
                                item.restaurantName
                              ).toLowerCase()
                        );

                      setSearch(
                        matchingRestaurant?.name ||
                          item.restaurantName ||
                          ""
                      );
                    }}
                  >
                    Manage Restaurant →
                  </button>
                )}

                {/* ---------- STATUS / DELETE ---------- */}

                <div className="admin-report-actions">
                  {!isReview && (
                    <label>
                      Status
                      <select
                        value={item.reportStatus}
                        onChange={(event) =>
                          changeReportStatus(
                            item,
                            event.target.value
                          )
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </label>
                  )}

                  <button
                    type="button"
                    className="admin-report-delete"
                    onClick={() =>
                      isReview
                        ? deleteReview(item)
                        : deleteReport(item)
                    }
                  >
                    {isReview ? "Delete Review" : "Delete Report"}
                  </button>
                </div>
              </article>
            );
          })}

          {!filteredReports.length && (
            <div
              className="admin-empty"
              style={{
                textAlign: "center",
                padding: "35px 15px",
              }}
            >
              <p
                style={{
                  fontSize: "30px",
                  marginBottom: "8px",
                }}
              >
                ☆
              </p>

              <strong>
                No customer feedback found.
              </strong>

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                }}
              >
                {combinedReports.length === 0
                  ? "Customer ratings and reviews will appear here after submission."
                  : "Try changing the search or filters."}
              </p>
            </div>
          )}
        </div>

        {filteredReports.length > FEEDBACK_PER_PAGE && (
          <div className="admin-recent-pagination">
            <span>
              Showing {feedbackFirstRow + 1}-
              {Math.min(
                feedbackFirstRow + FEEDBACK_PER_PAGE,
                filteredReports.length
              )}{" "}
              of {filteredReports.length}
            </span>

            <div>
              <button
                type="button"
                aria-label="Previous feedback"
                disabled={currentFeedbackPage === 1}
                onClick={() =>
                  setFeedbackPage(currentFeedbackPage - 1)
                }
              >
                ‹
              </button>

              <span>
                {currentFeedbackPage} / {feedbackPages}
              </span>

              <button
                type="button"
                aria-label="Next feedback"
                disabled={currentFeedbackPage === feedbackPages}
                onClick={() =>
                  setFeedbackPage(currentFeedbackPage + 1)
                }
              >
                ›
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );

  /* ================= SELECTED DETAILS ================= */

  const latestSelectedItem = selectedDetails
    ? selectedDetails.type === "restaurant"
      ? restaurants.find(
          (item) =>
            item.id === selectedDetails.item.id
        )
      : users.find(
          (item) =>
            item.id === selectedDetails.item.id
        )
    : null;

  /* ================= MAIN UI ================= */

  return (
    <div
      className="admin-page"
      onClick={(event) => {
        if (
          !event.target.closest(
            ".admin-more-wrapper"
          )
        ) {
          setOpenActionMenu(null);
        }
      }}
    >
      {/* ================= MOBILE MENU ================= */}

      <button
        type="button"
        className="admin-mobile-menu"
        onClick={() =>
          setSidebarOpen(
            (previous) => !previous
          )
        }
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {sidebarOpen && (
        <div
          className="admin-mobile-backdrop"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* ================= SIDEBAR ================= */}

      <aside
        className={`admin-sidebar ${
          sidebarOpen
            ? "admin-sidebar-open"
            : ""
        }`}
      >
        <div className="admin-logo">
          <img
            src={logoIcon}
            alt="NearBite logo"
            className="admin-logo-image"
          />

          <span>
            Near
            <span className="admin-logo-orange">
              Bite
            </span>
            <em> Admin</em>
          </span>
        </div>

        <nav className="admin-navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-item ${
                activeTab === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                changeTab(item.id)
              }
            >
              <span className="admin-nav-icon">
                {item.icon}
              </span>

              {item.title}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="admin-logout"
          onClick={logout}
        >
          <span>⇥</span> Logout
        </button>
      </aside>

      {/* ================= MAIN CONTENT ================= */}

      <main className="admin-main">
        {activeTab === "dashboard" &&
          renderDashboard()}

        {activeTab === "restaurants" &&
          renderRestaurants()}

        {activeTab === "users" &&
          renderUsers()}

        {activeTab === "dietary" &&
          renderTags("dietary")}

        {activeTab === "cuisine" &&
          renderTags("cuisine")}

        {activeTab === "category" &&
          renderTags("category")}

        {activeTab === "reports" &&
          renderReports()}

        {activeTab === "profile" &&
          renderProfile()}
      </main>

      {/* ================= RESTAURANT PROFILE AND MENU POPUP ================= */}

      {viewRestaurant && (
        <RestaurantViewModal
          restaurant={viewRestaurant}
          onClose={() => setViewRestaurant(null)}
        />
      )}

      {/* ================= DETAILS POPUP ================= */}

      {selectedDetails &&
        latestSelectedItem && (
          <DetailsModal
            item={latestSelectedItem}
            type={selectedDetails.type}
            onClose={() =>
              setSelectedDetails(null)
            }
            canChangeStatus={
              selectedDetails.type === "restaurant" &&
              latestSelectedItem.status === "pending"
            }
            onStatusChange={(status) =>
              changeItemStatus(
                latestSelectedItem,
                selectedDetails.type,
                status
              )
            }
          />
        )}
    </div>
  );
}
