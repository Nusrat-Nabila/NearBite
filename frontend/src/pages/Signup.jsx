import { useState } from "react";
import logoIcon from "../Image/logo.png";
import signupBackground from "../Image/signup-bg.jpg";
import "./Signup.css";

const accountTypes = [
  {
    id: "customer",
    icon: "👤",
    title: "Customer",
    description:
      "Find restaurants, explore menus, and save your favourite places.",
    button: "Create as Customer",
  },
  {
    id: "owner",
    icon: "🏬",
    title: "Restaurant Owner",
    description:
      "Register your restaurant, manage menu, opening hours and more.",
    button: "Create as Owner",
  },
];

export default function Signup({ onLoginClick, onBackHome, onChooseRole }) {
  const [selectedRole, setSelectedRole] = useState("customer");
  const [notice, setNotice] = useState("");

  const handleCreateAccount = (role) => {
    setSelectedRole(role);
    setNotice("");

    if (onChooseRole) {
      onChooseRole(role);
      return;
    }

    setNotice(
      `${role === "customer" ? "Customer" : "Restaurant Owner"} registration form will be connected next.`
    );
  };

  return (
    <main className="signup-page">
      {/* Left image panel */}
      <section
        className="signup-visual"
        style={{ backgroundImage: `url(${signupBackground})` }}
      >
        <div className="signup-visual-overlay" />

       <a
  href="#home"
  className="signup-brand"
  onClick={(e) => {
    if (onBackHome) {
      e.preventDefault();
      onBackHome();
    }
  }}
>
  <img src={logoIcon} alt="NearBite logo" />

  <span className="signup-brand-name">
    <span>Near</span>
    <span>Bite</span>
  </span>
</a>

        <div className="signup-hero-copy">
          <h1>
            Good Food
            <br />
            Brighter Days
          </h1>

          <p>
            Join NearBite and discover amazing restaurants, save your
            favourite places, and enjoy a better dining experience.
          </p>
        </div>

        <div className="signup-visual-footer">
          Discover • Dine • Enjoy with NearBite
        </div>
      </section>

      {/* Right signup panel */}
      <section className="signup-panel">
        <div className="signup-content">
          <header className="signup-heading">
            <h2>Create Your Account</h2>
            <p>Choose the account type that best fits you</p>
          </header>

          <div className="signup-role-list">
            {accountTypes.map((account, index) => (
              <article
                key={account.id}
                className={`signup-role-card ${
                  selectedRole === account.id ? "selected" : ""
                }`}
                style={{ "--card-index": index }}
              >
                <span className="signup-role-icon" aria-hidden="true">
                  {account.icon}
                </span>

                <h3>{account.title}</h3>

                <p>{account.description}</p>

                <button
                  type="button"
                  className={`signup-role-button ${
                    selectedRole === account.id ? "active" : ""
                  }`}
                  onClick={() => handleCreateAccount(account.id)}
                >
                  {account.button}
                  <span aria-hidden="true"> →</span>
                </button>
              </article>
            ))}
          </div>

          {notice && (
            <p className="signup-notice" role="status">
              {notice}
            </p>
          )}

          <p className="signup-login-prompt">
            Already have an account?{" "}
            <button
              type="button"
              className="signup-login-link"
              onClick={onLoginClick}
            >
              Login
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
