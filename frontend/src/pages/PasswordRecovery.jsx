import { useState } from "react";

import { apiCall, errorMessage, toBackendRole } from "../api";

import logoIcon from "../Image/logo.png";
import loginBackground from "../Image/login-bg.jpg";
import eyeOpen from "../Image/eye_open.png";
import eyeClose from "../Image/eye_close.png";

import "./Login.css";

/* The two password pages use the Login page's look (Login.css). */

const MIN_PASSWORD_LENGTH = 8;

const roles = [
  { id: "customer", icon: "👤", title: "Customer" },
  { id: "owner", icon: "🏪", title: "Restaurant Owner" },
];

const successStyle = {
  margin: 0,
  padding: "11px 13px",
  borderRadius: 8,
  background: "#dff3e3",
  color: "#18753b",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.5,
};

/* ================= SHARED LAYOUT ================= */

function RecoveryShell({ title, subtitle, onBackHome, children }) {
  return (
    <main className="login-page">
      <section
        className="login-visual"
        style={{ backgroundImage: `url(${loginBackground})` }}
      >
        <div className="login-visual-overlay" />

        <a
          href="#home"
          className="login-brand"
          onClick={(event) => {
            event.preventDefault();
            onBackHome?.();
          }}
        >
          <img src={logoIcon} alt="NearBite logo" />

          <span className="login-brand-name">
            <span>Near</span>
            <span>Bite</span>
          </span>
        </a>

        <button
          type="button"
          className="login-back-home"
          onClick={onBackHome}
        >
          <span aria-hidden="true">←</span>
          Back to Home
        </button>

        <div className="login-hero-copy">
          <h1>
            Good Food Brings
            <br />
            People <span>Together.</span>
          </h1>

          <p>
            Discover the best restaurants, explore menus, and find
            food you&apos;ll love, near you.
          </p>
        </div>

        <div className="login-visual-footer">
          Discover great food, near you.
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-container">
          <header className="login-heading">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </header>

          {children}
        </div>
      </section>
    </main>
  );
}

/* ================= FORGOT PASSWORD ================= */

// Asks for an email and sends a reset link to it.
export function ForgotPassword({
  initialRole = "customer",
  onBackToLogin,
  onBackHome,
}) {
  const [role, setRole] = useState(
    initialRole === "owner" ? "owner" : "customer"
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setIsSubmitting(true);

    const { ok, data } = await apiCall("/api/forgot_password/", {
      method: "POST",
      auth: false,
      body: { email: email.trim(), role: toBackendRole(role) },
    });

    setIsSubmitting(false);

    if (!ok) {
      setError(
        errorMessage(
          data,
          "Could not reach the server. Please try again."
        )
      );
      return;
    }

    setMessage(
      data?.message ||
        "If an account with that email exists, a reset link has been sent."
    );
  };

  return (
    <RecoveryShell
      title="Forgot Password?"
      subtitle="We will email you a link to choose a new password"
      onBackHome={onBackHome}
    >
      <div
        className="login-role-list"
        aria-label="Choose account type"
      >
        {roles.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`login-role-card ${
              role === item.id ? "selected" : ""
            }`}
            onClick={() => setRole(item.id)}
            aria-pressed={role === item.id}
          >
            <span className="login-role-icon" aria-hidden="true">
              {item.icon}
            </span>

            <span className="login-role-title">{item.title}</span>
          </button>
        ))}
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-field">
          <label htmlFor="forgot-email">Email</label>

          <div className="login-input-wrap">
            <span className="login-input-icon" aria-hidden="true">
              ✉
            </span>

            <input
              id="forgot-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              autoComplete="email"
              required
            />
          </div>
        </div>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p style={successStyle} role="status">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="login-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="login-signup-prompt">
        Remembered it?{" "}
        <button
          type="button"
          className="login-text-button"
          onClick={onBackToLogin}
        >
          Back to Login
        </button>
      </p>
    </RecoveryShell>
  );
}

/* ================= RESET PASSWORD ================= */

// Opened from the emailed link: sets the new password.
export function ResetPassword({ token, onBackToLogin, onBackHome }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");

    if (!token) {
      setError("This reset link is not valid. Please ask for a new one.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    const { ok, data } = await apiCall("/api/reset_password/", {
      method: "POST",
      auth: false,
      body: {
        token,
        new_password: password,
        confirm_password: confirm,
      },
    });

    setIsSubmitting(false);

    if (!ok) {
      setError(
        errorMessage(
          data,
          "Could not reach the server. Please try again."
        )
      );
      return;
    }

    setDone(true);
  };

  return (
    <RecoveryShell
      title="Choose a New Password"
      subtitle="Use at least 8 characters"
      onBackHome={onBackHome}
    >
      {done ? (
        <>
          <p style={successStyle} role="status">
            Password updated. You can now log in.
          </p>

          <button
            type="button"
            className="login-submit"
            onClick={onBackToLogin}
          >
            Go to Login
          </button>
        </>
      ) : (
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="reset-password">New Password</label>

            <div className="login-input-wrap">
              <span className="login-input-icon" aria-hidden="true">
                🔒
              </span>

              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a new password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                <img
                  src={showPassword ? eyeClose : eyeOpen}
                  alt=""
                  className="password-eye-icon"
                />
              </button>
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="reset-confirm">Confirm Password</label>

            <div className="login-input-wrap">
              <span className="login-input-icon" aria-hidden="true">
                🔒
              </span>

              <input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                placeholder="Enter it again"
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Update Password"}
          </button>
        </form>
      )}

      {!done && (
        <p className="login-signup-prompt">
          <button
            type="button"
            className="login-text-button"
            onClick={onBackToLogin}
          >
            Back to Login
          </button>
        </p>
      )}
    </RecoveryShell>
  );
}
