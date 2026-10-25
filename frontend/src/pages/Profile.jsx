
import { useEffect, useRef, useState } from "react";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import { apiCall, errorMessage, mapBackendUser } from "../api";

// Default profile image
import defaultProfileImage from "../Image/profile.png";

import "./Profile.css";

const cityAreas = {
  Dhaka: [
    "Dhanmondi",
    "Mohammadpur",
    "Mirpur",
    "Uttara",
    "Gulshan",
    "Banani",
    "Bashundhara",
    "Badda",
    "Motijheel",
    "Mohakhali",
    "Tejgaon",
    "Lalbagh",
    "Jatrabari",
    "Rampura",
    "Khilgaon",
  ],
  Chattogram: [
    "Agrabad",
    "GEC Circle",
    "Panchlaish",
    "Khulshi",
    "Nasirabad",
    "Halishahar",
  ],
  Sylhet: [
    "Zindabazar",
    "Amberkhana",
    "Shibganj",
    "Uposhohor",
    "Mirabazar",
  ],
  Rajshahi: [
    "Shaheb Bazar",
    "Boalia",
    "Motihar",
    "Kazla",
    "Uposhohor",
  ],
  Khulna: [
    "Sonadanga",
    "Khalishpur",
    "Boyra",
    "Daulatpur",
  ],
  Barishal: [
    "Sadar Road",
    "Nathullabad",
    "Rupatali",
  ],
  Rangpur: [
    "Jahaj Company More",
    "Dhap",
    "Modern More",
  ],
  Mymensingh: [
    "Town Hall",
    "Ganginarpar",
    "Charpara",
  ],
};

const cities = Object.keys(cityAreas);

const initialProfile = {
  name: "",
  email: "",
  phone: "",
  city: "Dhaka",
  area: "",
  address: "",
  bio: "",
  photo: "",
};

function getUserProfile(user) {
  return {
    ...initialProfile,
    ...(user || {}),

    name: user?.name || user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    city: user?.city || "Dhaka",
    area: user?.area || "",
    address: user?.address || "",
    bio: user?.bio || "",

    // Preserve an intentionally removed picture.
    photo:
      user?.photo ??
      user?.profileImage ??
      user?.profilePicture ??
      user?.avatar ??
      user?.image ??
      user?.photoURL ??
      "",
  };
}

export default function Profile({
  user,
  isLoggedIn,
  onLoginClick,
  onHomeClick,
  onExploreClick,
  onCuisineClick,
  onDealsClick,
  onAboutClick,
  onProfileClick,
  onFavoritesClick,
  onReviewsClick,
  onLogout,
  onLogoutClick,
  onProfileUpdate,
}) {
  const [profile, setProfile] = useState(() =>
    getUserProfile(user)
  );

  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef(null);
  const originalProfileRef = useRef(getUserProfile(user));

  // Sync saved user data with the profile page.
  useEffect(() => {
    if (!user) return;

    const nextProfile = getUserProfile(user);

    setProfile(nextProfile);
    originalProfileRef.current = nextProfile;
  }, [user]);

  // Reset image error when photo changes.
  useEffect(() => {
    setImageError(false);
  }, [profile.photo]);

  const availableAreas = cityAreas[profile.city] || [];

  // Uploaded image if available, otherwise profile.png.
  const displayProfileImage =
    profile.photo && !imageError
      ? profile.photo
      : defaultProfileImage;

  const updateField = (event) => {
    if (!isEditing) return;

    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "city" ? { area: "" } : {}),
    }));

    setSaved(false);
    setError("");
  };

  const handleEdit = () => {
    originalProfileRef.current = { ...profile };

    setIsEditing(true);
    setSaved(false);
    setError("");
  };

  // Upload profile picture.
  const handlePhotoChange = (event) => {
    if (!isEditing) {
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not load the image.");
        return;
      }

      setProfile((previous) => ({
        ...previous,
        photo: reader.result,
        profileImage: reader.result,
      }));

      setImageError(false);
      setSaved(false);
      setError("");
    };

    reader.onerror = () => {
      setError(
        "Could not load the image. Please try again."
      );
    };

    reader.readAsDataURL(file);

    // Allow selecting the same image again.
    event.target.value = "";
  };

  // Remove uploaded picture and restore default avatar.
  const handleRemovePhoto = () => {
    if (!isEditing) return;

    setProfile((previous) => ({
      ...previous,
      photo: "",
      profileImage: "",
    }));

    setImageError(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSaved(false);
    setError("");
  };

  // Save profile changes to the backend, then to App.jsx.
  const handleSave = async (event) => {
    event.preventDefault();

    if (!isEditing || isSaving) return;

    setError("");
    setSaved(false);

    if (!profile.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!profile.city) {
      setError("Please select your city.");
      return;
    }

    if (!profile.area) {
      setError("Please select your area.");
      return;
    }

    const form = new FormData();

    form.append("customer_name", profile.name.trim());
    form.append("customer_email", profile.email.trim());
    form.append("customer_phone", profile.phone.trim());
    form.append("customer_address", profile.address.trim());
    form.append("customer_city", profile.city);
    form.append("customer_area", profile.area);

    // A picture chosen just now is a data: URL: send it as a file.
    // A removed picture is sent as an empty value. An unchanged one is not sent.
    const originalPhoto = originalProfileRef.current.photo || "";

    if (profile.photo.startsWith("data:")) {
      const blob = await (await fetch(profile.photo)).blob();
      const extension = blob.type.split("/")[1] || "png";

      form.append(
        "customer_image",
        blob,
        `profile.${extension}`
      );
    } else if (!profile.photo && originalPhoto) {
      form.append("customer_image", "");
    }

    setIsSaving(true);

    const { ok, data } = await apiCall(
      `/api/update_customer_profile/${user.id}/`,
      { method: "PUT", body: form }
    );

    setIsSaving(false);

    if (!ok) {
      setError(errorMessage(data));
      return;
    }

    // What the backend saved (the picture is now its address).
    const updatedProfile = {
      ...profile,
      ...mapBackendUser("customer", data),
    };

    if (typeof onProfileUpdate === "function") {
      onProfileUpdate(updatedProfile);
    }

    setProfile(updatedProfile);
    originalProfileRef.current = { ...updatedProfile };

    setIsEditing(false);
    setSaved(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Cancel changes and restore saved profile.
  const handleCancel = () => {
    setProfile({ ...originalProfileRef.current });

    setIsEditing(false);
    setImageError(false);
    setError("");
    setSaved(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="profile-page">
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
        onLogout={onLogout}
        onLogoutClick={onLogoutClick}
        user={user}
        isLoggedIn={isLoggedIn || Boolean(user)}
      />

      <main className="profile-main">
        <div className="profile-container">
          <header className="profile-page-heading">
            <div>
              <span className="profile-eyebrow">
                YOUR ACCOUNT
              </span>

              <h1>My Profile</h1>

              <p>
                Manage your personal information and
                delivery location.
              </p>
            </div>
          </header>

          <div className="profile-layout">
            {/* Left profile summary */}
            <aside className="profile-summary-card">
              <div className="profile-cover">
                <span className="profile-cover-decoration" />
              </div>

              <div className="profile-avatar-wrap">
                {/* Default or uploaded profile image */}
                <img
                  key={displayProfileImage}
                  className="profile-avatar"
                  src={displayProfileImage}
                  alt="Your profile"
                  onError={() => {
                    if (
                      displayProfileImage !==
                      defaultProfileImage
                    ) {
                      setImageError(true);
                    }
                  }}
                />

                <button
                  type="button"
                  className="profile-avatar-edit"
                  aria-label="Upload profile picture"
                  disabled={!isEditing}
                  onClick={() => {
                    if (isEditing) {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="profile-file-input"
                onChange={handlePhotoChange}
                aria-label="Choose profile picture"
                disabled={!isEditing}
              />

              <div className="profile-summary-content">
                <h2>{profile.name || "Your Name"}</h2>

                <p className="profile-summary-email">
                  {profile.email || "Add your email address"}
                </p>

                <div className="profile-location-chip">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <circle
                      cx="12"
                      cy="10"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                  </svg>

                  <span>
                    {[profile.area, profile.city]
                      .filter(Boolean)
                      .join(", ") || "Set your location"}
                  </span>
                </div>

                <div className="profile-summary-divider" />

                <div className="profile-summary-info">
                  <span>Phone number</span>
                  <strong>
                    {profile.phone || "Not added yet"}
                  </strong>
                </div>

                <div className="profile-summary-info">
                  <span>City</span>
                  <strong>
                    {profile.city || "Not selected"}
                  </strong>
                </div>

                <div className="profile-summary-info">
                  <span>Area</span>
                  <strong>
                    {profile.area || "Not selected"}
                  </strong>
                </div>

                <button
                  type="button"
                  className="profile-upload-button"
                  disabled={!isEditing}
                  onClick={() => {
                    if (isEditing) {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Change profile picture
                </button>

                {/* Remove only uploaded picture */}
                {profile.photo && (
                  <button
                    type="button"
                    className="profile-remove-photo"
                    onClick={handleRemovePhoto}
                    disabled={!isEditing}
                  >
                    Remove picture
                  </button>
                )}

                <p className="profile-image-hint">
                  JPG, PNG or other image formats · Max 5 MB
                </p>
              </div>
            </aside>

            {/* Right personal information */}
            <section className="profile-form-card">
              <div className="profile-form-heading">
                <div>
                  <h2>Personal Information</h2>
                  <p>
                    Keep your profile details up to date.
                  </p>
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    className="profile-edit-label profile-edit-button"
                    onClick={handleEdit}
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="m15 5 4 4M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Edit
                  </button>
                )}

                {isEditing && (
                  <span className="profile-edit-label">
                    Editing
                  </span>
                )}
              </div>

              <form
                className="profile-form"
                onSubmit={handleSave}
              >
                <div className="profile-field">
                  <label htmlFor="profile-name">
                    Full Name <span>*</span>
                  </label>

                  <input
                    id="profile-name"
                    name="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={profile.name}
                    onChange={updateField}
                    autoComplete="name"
                    required
                    disabled={!isEditing}
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-email">
                    Email Address
                  </label>

                  <input
                    id="profile-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={profile.email}
                    onChange={updateField}
                    autoComplete="email"
                    disabled={!isEditing}
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-phone">
                    Phone Number
                  </label>

                  <input
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    placeholder="+880 1XXX-XXXXXX"
                    value={profile.phone}
                    onChange={updateField}
                    autoComplete="tel"
                    disabled={!isEditing}
                  />
                </div>

                <div className="profile-form-divider" />

                <div className="profile-section-label">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="12"
                      cy="10"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>

                  <div>
                    <h3>Location Details</h3>
                    <p>
                      Choose your city and neighbourhood.
                    </p>
                  </div>
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-city">
                    City <span>*</span>
                  </label>

                  <select
                    id="profile-city"
                    name="city"
                    value={profile.city}
                    onChange={updateField}
                    required
                    disabled={!isEditing}
                  >
                    <option value="">
                      Select your city
                    </option>

                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-area">
                    Area / Neighbourhood <span>*</span>
                  </label>

                  <select
                    id="profile-area"
                    name="area"
                    value={profile.area}
                    onChange={updateField}
                    required
                    disabled={!isEditing || !profile.city}
                  >
                    <option value="">
                      Select your area
                    </option>

                    {availableAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>

                  <small>
                    Areas update automatically when you
                    change your city.
                  </small>
                </div>

                <div className="profile-field profile-address-field">
                  <label htmlFor="profile-address">
                    Street Address
                  </label>

                  <textarea
                    id="profile-address"
                    name="address"
                    rows="3"
                    placeholder="House, road, block or additional address details"
                    value={profile.address}
                    onChange={updateField}
                    autoComplete="street-address"
                    disabled={!isEditing}
                  />
                </div>

                {error && (
                  <p
                    className="profile-message profile-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                {saved && (
                  <p
                    className="profile-message profile-success"
                    role="status"
                  >
                    Your profile changes have been saved.
                  </p>
                )}

                {isEditing && (
                  <div className="profile-form-actions">
                    <button
                      type="button"
                      className="profile-cancel-button"
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="profile-save-button"
                      disabled={isSaving}
                    >
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="m5 12 4 4L19 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Save Changes
                    </button>
                  </div>
                )}
              </form>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
