
import { img } from "../data/data";

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="footer-grid">

        {/* Footer Logo + Brand Name */}
        <div className="footer-brand">
          <a href="#home" className="footer-brand-logo">
  <img
    src={img.logo}
    alt="NearBite logo"
    className="footer-logo"
  />

  <span className="footer-brand-name">
    <span className="footer-near">Near</span><span className="footer-bite">Bite</span>
  </span>
</a>

          <p>Discover great food, near you.</p>

          <div className="socials">
            <a href="#" aria-label="Facebook">
              <img src={img.facebook} alt="Facebook" />
            </a>

            <a href="#" aria-label="Instagram">
              <img src={img.instagram} alt="Instagram" />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4>Quick links</h4>
          <a href="#home">Home</a>
          <a href="#restaurants">Explore</a>
          <a href="#cuisines">Cuisines</a>
          <a href="#footer">About Us</a>
          <a href="#deals">Deals</a>
        </div>

        {/* Users */}
        <div>
          <h4>Users</h4>
          <a href="#">Login</a>
          <a href="#">Register</a>
          <a href="#">Favorites</a>
          <a href="#">Profile</a>
        </div>

        {/* Support */}
        <div>
          <h4>Support</h4>
          <a href="#">Help Center</a>
          <a href="#">Contact Us</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>

      </div>

      <hr />

      <p className="copy">
        © 2025 NearBite. All rights reserved.
      </p>
    </footer>
  );
}
