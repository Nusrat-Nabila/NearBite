
import { useState } from "react";
import logoIcon from "../Image/logo.png";
import eyeOpen from "../Image/eye_open.png";
import eyeClose from "../Image/eye_close.png";
import { apiCall, errorMessage } from "../api";
import "./Coustomer_form.css";

const cityAreas = {
  Dhaka: ["Dhanmondi", "Mirpur", "Uttara", "Gulshan", "Banani", "Mohammadpur"],
  Chattogram: ["Agrabad", "GEC", "Panchlaish", "Halishahar"],
  Sylhet: ["Zindabazar", "Ambarkhana", "Shibganj"],
  Rajshahi: ["Boalia", "Motihar", "Rajpara"],
  Khulna: ["Sonadanga", "Khalishpur", "Daulatpur"],
  Barishal: ["Nathullabad", "Rupatali", "Sadar Road"],
  Rangpur: ["Jahaj Company", "Dhap", "Modern More"],
  Mymensingh: ["Ganginarpar", "Charpara", "Town Hall"],
};

export default function Form({ onBack, onLoginClick }) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    area: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "city" ? { area: "" } : {}),
    }));

    setNotice("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (formData.password !== formData.confirmPassword) {
      setNotice("Passwords do not match. Please try again.");
      return;
    }

    if (formData.password.length < 8) {
      setNotice("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);

    const { ok, data } = await apiCall("/api/customer_signup/", {
      method: "POST",
      auth: false,
      body: {
        customer_name: formData.fullName.trim(),
        customer_email: formData.email.trim(),
        customer_phone: formData.phone.trim(),
        customer_city: formData.city,
        customer_area: formData.area,
        customer_address: formData.address.trim(),
        customer_password: formData.password,
        confirm_password: formData.confirmPassword,
      },
    });

    setIsSubmitting(false);

    if (!ok) {
      setNotice(errorMessage(data));
      return;
    }

    setFormData({
      fullName: "",
      email: "",
      phone: "",
      city: "",
      area: "",
      address: "",
      password: "",
      confirmPassword: "",
    });

    setNotice("Account created! You can now log in.");
  };

  const availableAreas = formData.city
    ? cityAreas[formData.city] || []
    : [];

  return (
    <main className="customer-form-page">
      <header className="customer-form-header">
        <button
          type="button"
          className="customer-form-brand"
          onClick={onBack}
          aria-label="Back to previous page"
        >
          <img src={logoIcon} alt="NearBite logo" />
          <span className="customer-brand-name">
            <span>Near</span>
            <span>Bite</span>
          </span>
        </button>

        <button
          type="button"
          className="customer-form-back"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span> Back
        </button>
      </header>

      <section className="customer-form-content">
        <div className="customer-form-heading">
          <h1>Create Customer Account</h1>
          <p>Join NearBite and start exploring great food.</p>
        </div>

        <form className="customer-form" onSubmit={handleSubmit}>
          <div className="customer-field">
            <label htmlFor="fullName">Full Name</label>
            <div className="customer-input-wrap">
              <span className="customer-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z" />
                </svg>
              </span>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter your name"
                value={formData.fullName}
                onChange={updateField}
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="customer-field">
            <label htmlFor="email">Email</label>
            <div className="customer-input-wrap">
              <span className="customer-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 8L4 7v10h16V7l-8 6Z" />
                </svg>
              </span>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={updateField}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="customer-field">
            <label htmlFor="phone">Number</label>
            <div className="customer-input-wrap">
              <span className="customer-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.6 2.8 10 6.2 7.8 9.1a15 15 0 0 0 7.1 7.1l2.9-2.2 3.4 3.4-1.8 3.1c-.5.8-1.5 1.2-2.4.9C9.8 19.2 4.8 14.2 2.6 7c-.3-.9.1-1.9.9-2.4l3.1-1.8Z" />
                </svg>
              </span>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Enter your number"
                value={formData.phone}
                onChange={updateField}
                autoComplete="tel"
                required
              />
            </div>
          </div>

          <div className="customer-location-row">
            <div className="customer-field">
              <label htmlFor="city">City</label>
              <div className="customer-input-wrap customer-select-wrap">
                <span className="customer-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                  </svg>
                </span>
                <select
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={updateField}
                  required
                >
                  <option value="">Select your City</option>
                  {Object.keys(cityAreas).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="customer-field">
              <label htmlFor="area">Area</label>
              <div className="customer-input-wrap customer-select-wrap">
                <select
                  id="area"
                  name="area"
                  value={formData.area}
                  onChange={updateField}
                  disabled={!formData.city}
                  required
                >
                  <option value="">
                    {formData.city ? "Select Area" : "Select City First"}
                  </option>
                  {availableAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="customer-field">
            <label htmlFor="address">Address / Location</label>
            <div className="customer-input-wrap">
              <span className="customer-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                </svg>
              </span>
              <input
                id="address"
                name="address"
                type="text"
                placeholder="Enter your location"
                value={formData.address}
                onChange={updateField}
                autoComplete="street-address"
                required
              />
            </div>
          </div>

          <div className="customer-field">
            <label htmlFor="password">Password</label>
            <div className="customer-input-wrap">
              <span className="customer-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM10 6a2 2 0 0 1 4 0v2h-4V6Z" />
                </svg>
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={updateField}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="customer-eye-button"
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

          <div className="customer-field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="customer-input-wrap">
              <span className="customer-input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM10 6a2 2 0 0 1 4 0v2h-4V6Z" />
                </svg>
              </span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Enter your password again"
                value={formData.confirmPassword}
                onChange={updateField}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="customer-eye-button"
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

          {notice && (
            <p
              className={`customer-form-notice ${
                notice.startsWith("Account created") ? "success" : ""
              }`}
              role="status"
            >
              {notice}
            </p>
          )}

          <button
            type="submit"
            className="customer-form-submit"
            disabled={isSubmitting}
          >
            Create account
          </button>

          <p className="customer-form-terms">
            By creating an account, you agree to our Terms
            <br />
            &amp; Conditions and{" "}
            <a href="#privacy">Privacy Policy</a>.
          </p>

          <p className="customer-form-login-prompt">
            Already have an account?{" "}
            <button
              type="button"
              className="customer-form-login-link"
              onClick={onLoginClick}
            >
              Login
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
