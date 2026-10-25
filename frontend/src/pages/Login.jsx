
import { useState } from "react";

import { login } from "../api";

import logoIcon from "../Image/logo.png";
import loginBackground from "../Image/login-bg.jpg";
import eyeOpen from "../Image/eye_open.png";
import eyeClose from "../Image/eye_close.png";

import "./Login.css";

/* ================= ACCOUNT ROLES ================= */

const roles = [
  {
    id: "customer",
    icon: "👤",
    title: "Customer",
    description: "Find & explore restaurants",
  },
  {
    id: "owner",
    icon: "🏪",
    title: "Restaurant Owner",
    description: "Manage your restaurant",
  },
  {
    id: "admin",
    icon: "🖥️",
    title: "Admin",
    description: "Platform management",
  },
];

/* ================= LOGIN COMPONENT ================= */

export default function Login({
  onBackHome,
  onCreateAccountClick,
  onLoginSuccess,
  onForgotPasswordClick,
}) {
  /* ================= STATE ================= */

  const [role, setRole] = useState("customer");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = role === "admin";

  /* ================= ROLE CHANGE ================= */

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);

    setError("");
    setPassword("");
    setShowPassword(false);
  };

  /* ================= LOGIN SUBMIT ================= */

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    if (isSubmitting) return;

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    /* ---------- CHECK APP CONNECTION ---------- */

    if (typeof onLoginSuccess !== "function") {
      setError(
        "Login connection is not configured yet."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await login(
        role,
        email.trim(),
        password
      );

      onLoginSuccess(user);
    } catch (err) {
      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= FORGOT PASSWORD ================= */

  const handleForgotPassword = () => {
    if (isAdmin) {
      window.alert(
        "Admin password reset must be handled by the platform administrator."
      );
      return;
    }

    onForgotPasswordClick?.(role);
  };

  /* ================= CREATE ACCOUNT ================= */

  const handleCreateAccount = () => {
    if (isAdmin) {
      window.alert(
        "Admin accounts cannot be created from public signup."
      );
      return;
    }

    if (typeof onCreateAccountClick === "function") {
      onCreateAccountClick(role);
      return;
    }

    window.alert(
      "Signup page is not connected yet."
    );
  };

  /* ================= UI ================= */

  return (
    <main className="login-page">
      {/* ================= LEFT IMAGE PANEL ================= */}

      <section
        className="login-visual"
        style={{
          backgroundImage: `url(${loginBackground})`,
        }}
      >
        <div className="login-visual-overlay" />

        {/* NearBite logo */}
        <a
          href="#home"
          className="login-brand"
          onClick={(event) => {
            event.preventDefault();
            onBackHome?.();
          }}
        >
          <img
            src={logoIcon}
            alt="NearBite logo"
          />

          <span className="login-brand-name">
            <span>Near</span>
            <span>Bite</span>
          </span>
        </a>

        {/* Back to Home */}
        <button
          type="button"
          className="login-back-home"
          onClick={onBackHome}
        >
          <span aria-hidden="true">←</span>
          Back to Home
        </button>

        {/* Hero copy */}
        <div className="login-hero-copy">
          <h1>
            Good Food Brings
            <br />
            People <span>Together.</span>
          </h1>

          <p>
            Discover the best restaurants, explore menus,
            and find food you&apos;ll love, near you.
          </p>
        </div>

        <div className="login-visual-footer">
          Discover great food, near you.
        </div>
      </section>

      {/* ================= RIGHT LOGIN PANEL ================= */}

      <section className="login-panel">
        <div className="login-form-container">
          {/* Heading */}
          <header className="login-heading">
            <h2>Welcome Back!</h2>

            <p>
              Login to continue to your account
            </p>
          </header>

          {/* ================= ROLE SELECTION ================= */}

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
                onClick={() =>
                  handleRoleChange(item.id)
                }
                aria-pressed={role === item.id}
              >
                <span
                  className="login-role-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span className="login-role-title">
                  {item.title}
                </span>

                <span className="login-role-description">
                  {item.description}
                </span>
              </button>
            ))}
          </div>

          {/* ================= LOGIN FORM ================= */}

          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            {/* ================= EMAIL ================= */}

            <div className="login-field">
              <label htmlFor="login-email">Email</label>

              <div className="login-input-wrap">
                <span
                  className="login-input-icon"
                  aria-hidden="true"
                >
                  ✉
                </span>

                <input
                  id="login-email"
                  name="email"
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

            {/* ================= PASSWORD ================= */}

            <div className="login-field">
              <label htmlFor="login-password">
                Password
              </label>

              <div className="login-input-wrap">
                <span
                  className="login-input-icon"
                  aria-hidden="true"
                >
                  🔒
                </span>

                <input
                  id="login-password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  required
                />

                {/* Password show/hide */}
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (previous) => !previous
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  <img
                    src={
                      showPassword
                        ? eyeClose
                        : eyeOpen
                    }
                    alt=""
                    className="password-eye-icon"
                  />
                </button>
              </div>
            </div>

            {/* ================= FORGOT PASSWORD ================= */}

            <div className="login-options">
              <button
                type="button"
                className="login-text-button"
                onClick={handleForgotPassword}
              >
                Forgot Password?
              </button>
            </div>

            {/* ================= ERROR MESSAGE ================= */}

            {error && (
              <p
                className="login-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* ================= SUBMIT ================= */}

            <button
              type="submit"
              className="login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Logging in..."
                : "Log In"}
            </button>
          </form>

          {/* ================= CREATE ACCOUNT ================= */}

          <p className="login-signup-prompt">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="login-text-button"
              onClick={handleCreateAccount}
            >
              Create Account
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
