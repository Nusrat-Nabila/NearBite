import { useState } from "react";
import logoIcon from "../Image/logo.png";
import eyeOpen from "../Image/eye_open.png";
import eyeClose from "../Image/eye_close.png";
import { apiCall, errorMessage } from "../api";
import "./RestaurantOwner_form.css";

const cities = {
  Dhaka: [
    "Dhanmondi",
    "Mirpur",
    "Uttara",
    "Gulshan",
    "Banani",
    "Mohammadpur",
    "Bashundhara",
    "Motijheel",
    "Badda",
    "Farmgate",
  ],
  Chattogram: [
    "Agrabad",
    "GEC Circle",
    "Panchlaish",
    "Khulshi",
    "Halishahar",
  ],
  Sylhet: ["Zindabazar", "Ambarkhana", "Upashahar", "Shibganj"],
  Khulna: ["Sonadanga", "Khalishpur", "Boyra", "Daulatpur"],
  Rajshahi: ["Shaheb Bazar", "Uposhahar", "Kazla", "Motihar"],
};

const documentFields = [
  { name: "tin_certificate", label: "TIN Certificate" },
  { name: "vat_certificate", label: "VAT Certificate" },
  { name: "trade_license", label: "Trade License" },
  { name: "restaurant_license", label: "Restaurant License" },
];

const MAX_DOCUMENT_MB = 2;

export default function RestaurantOwner_form({
  onBack,
  onLoginClick,
}) {
  const [form, setForm] = useState({
    restaurantName: "",
    email: "",
    number: "",
    city: "",
    area: "",
    address: "",
    registrationNo: "",
    password: "",
    confirmPassword: "",
  });

  const [documents, setDocuments] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "city" ? { area: "" } : {}),
    }));

    setError("");
    setSuccess("");
  };

  const pickDocument = (e) => {
    const { name, files } = e.target;
    const file = files[0];

    if (file && file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
      setError(`Each document must be ${MAX_DOCUMENT_MB} MB or smaller.`);
      e.target.value = "";
      return;
    }

    setDocuments((prev) => ({ ...prev, [name]: file || null }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Password and Confirm Password do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (documentFields.some(({ name }) => !documents[name])) {
      setError("Please upload all four documents as PDF files.");
      return;
    }

    setIsSubmitting(true);

    const body = new FormData();
    body.append("restaurant_name", form.restaurantName.trim());
    body.append("restaurant_email", form.email.trim());
    body.append("restaurant_phone", form.number.trim());
    body.append("restaurant_city", form.city);
    body.append("restaurant_area", form.area);
    body.append("restaurant_location", form.address.trim());
    body.append("restaurant_business_reg_id", form.registrationNo.trim());
    body.append("restaurant_password", form.password);
    body.append("confirm_password", form.confirmPassword);
    documentFields.forEach(({ name }) => body.append(name, documents[name]));

    const { ok, data } = await apiCall("/api/restaurant_request_signup/", {
      method: "POST",
      auth: false,
      body,
    });

    setIsSubmitting(false);

    if (!ok) {
      setError(errorMessage(data));
      return;
    }

    setForm({
      restaurantName: "",
      email: "",
      number: "",
      city: "",
      area: "",
      address: "",
      registrationNo: "",
      password: "",
      confirmPassword: "",
    });
    setDocuments({});
    e.target.reset?.();

    setSuccess(
      data?.message || "Request submitted. Awaiting admin approval."
    );
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <main className="owner-form-page">
      <header className="owner-form-header">
        <a
          href="#home"
          className="owner-form-brand"
          onClick={(e) => {
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <img src={logoIcon} alt="NearBite logo" />
          <span className="owner-brand-name">
            <span>Near</span>
            <span>Bite</span>
          </span>
        </a>

        <button
          type="button"
          className="owner-back-button"
          onClick={handleBack}
        >
          <span aria-hidden="true">←</span> Back
        </button>
      </header>

      <section className="owner-form-content">
        <div className="owner-form-heading">
          <h1>Create Restaurant Owner Account</h1>
          <p>Register your restaurant and get started.</p>
        </div>

        <form className="owner-registration-form" onSubmit={handleSubmit}>
          <div className="owner-field">
            <label htmlFor="owner-restaurant-name">
              Restaurant Name
            </label>
            <div className="owner-input-wrap">
              <span className="owner-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8v-2a7 7 0 0 0-14 0v2h14Z" />
                </svg>
              </span>
              <input
                id="owner-restaurant-name"
                name="restaurantName"
                value={form.restaurantName}
                onChange={updateField}
                placeholder="Enter restaurant name"
                autoComplete="organization"
                required
              />
            </div>
          </div>

          <div className="owner-field">
            <label htmlFor="owner-email">Email</label>
            <div className="owner-input-wrap">
              <span className="owner-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7L4 7v10h16V7l-8 5Zm0-2 7-4H5l7 4Z" />
                </svg>
              </span>
              <input
                id="owner-email"
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="owner-field">
            <label htmlFor="owner-number">Number</label>
            <div className="owner-input-wrap">
              <span className="owner-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.1-.2 11 11 0 0 0 3.5.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .6 3.5 1 1 0 0 1-.2 1.1l-2.3 2.2Z" />
                </svg>
              </span>
              <input
                id="owner-number"
                type="tel"
                name="number"
                value={form.number}
                onChange={updateField}
                placeholder="Enter your number"
                autoComplete="tel"
                required
              />
            </div>
          </div>

          <div className="owner-location-row">
            <div className="owner-field">
              <label htmlFor="owner-city">City</label>
              <div className="owner-select-wrap">
                <select
                  id="owner-city"
                  name="city"
                  value={form.city}
                  onChange={updateField}
                  required
                >
                  <option value="">Enter your City</option>
                  {Object.keys(cities).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="owner-field">
              <label htmlFor="owner-area">Area</label>
              <div className="owner-select-wrap">
                <select
                  id="owner-area"
                  name="area"
                  value={form.area}
                  onChange={updateField}
                  disabled={!form.city}
                  required
                >
                  <option value="">Select Area</option>
                  {(cities[form.city] || []).map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="owner-field">
            <label htmlFor="owner-address">Address / Location</label>
            <div className="owner-input-wrap">
              <span className="owner-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                </svg>
              </span>
              <input
                id="owner-address"
                name="address"
                value={form.address}
                onChange={updateField}
                placeholder="Enter your location"
                autoComplete="street-address"
                required
              />
            </div>
          </div>

          <div className="owner-field">
            <label htmlFor="owner-registration">
              Business registration No
            </label>
            <div className="owner-input-wrap">
              <span className="owner-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-7-7Zm0 2.5L18.5 9H14V4.5ZM5 4h7v7h7v9H5V4Zm2 9h10v1.5H7V13Zm0 3h10v1.5H7V16Z" />
                </svg>
              </span>
              <input
                id="owner-registration"
                name="registrationNo"
                value={form.registrationNo}
                onChange={updateField}
                placeholder="Enter your Business registration No or Id"
                required
              />
            </div>
          </div>

          {documentFields.map(({ name, label }) => (
            <div className="owner-field" key={name}>
              <label htmlFor={`owner-${name}`}>{label} (PDF)</label>
              <div className="owner-input-wrap">
                <input
                  id={`owner-${name}`}
                  name={name}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={pickDocument}
                  required
                />
              </div>
            </div>
          ))}

          <div className="owner-field">
            <label htmlFor="owner-password">Password</label>
            <div className="owner-input-wrap">
              <span className="owner-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM10 6a2 2 0 0 1 4 0v2h-4V6Z" />
                </svg>
              </span>
              <input
                id="owner-password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={updateField}
                placeholder="Enter your password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="owner-eye-button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <img
                  src={showPassword ? eyeOpen : eyeClose}
                  alt=""
                />
              </button>
            </div>
          </div>

          <div className="owner-field">
            <label htmlFor="owner-confirm-password">
              Confirm Password
            </label>
            <div className="owner-input-wrap">
              <span className="owner-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM10 6a2 2 0 0 1 4 0v2h-4V6Z" />
                </svg>
              </span>
              <input
                id="owner-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={updateField}
                placeholder="Enter your password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="owner-eye-button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                <img
                  src={showConfirmPassword ? eyeOpen : eyeClose}
                  alt=""
                />
              </button>
            </div>
          </div>

          {error && (
            <p className="owner-form-message error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="owner-form-message success" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            className="owner-submit-button"
            disabled={isSubmitting}
          >
            Create account
          </button>

          <p className="owner-terms">
            By creating an account, you agree to our Terms
            <br />
            &amp; Conditions and <a href="#privacy">Privacy Policy.</a>
          </p>
        </form>

        <p className="owner-login-prompt">
          Already have an account?{" "}
          <button type="button" onClick={onLoginClick}>
            Login
          </button>
        </p>
      </section>
    </main>
  );
}
