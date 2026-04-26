// src/components/Home.js
import React from 'react';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <h2>AQUA-LLERA</h2>
            <span>Water Station Management</span>
          </div>
          <div className="nav-buttons">
            <button className="btn-login" onClick={() => window.location.href = '/login'}>
              Station Login
            </button>
            <button className="btn-signup" onClick={() => window.location.href = '/signup'}>
              Register Station
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>Manage Your Water Station Efficiently</h1>
          <p>
            Streamline your water delivery business with our comprehensive management system. 
            Handle orders, track deliveries, and grow your customer base all in one place.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => window.location.href = '/signup'}>
              Get Started Today
            </button>
          </div>
        </div>
        <div className="hero-image">
          <div className="placeholder-image">
            💧 Water Station Dashboard Preview
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2>Why Choose AQUA-LLERA?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Real-time Dashboard</h3>
              <p>Monitor your business performance with live statistics and analytics</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚚</div>
              <h3>Order Management</h3>
              <p>Accept, track, and manage delivery orders efficiently</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Pricing Control</h3>
              <p>Set and update your water prices and delivery fees easily</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>Business Hours</h3>
              <p>Manage your operating hours and service availability</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📍</div>
              <h3>Location Management</h3>
              <p>Update your station location and service areas</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Friendly</h3>
              <p>Manage your station on-the-go with our responsive design</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Streamline Your Water Business?</h2>
          <p>Join hundreds of water stations already using AQUA-LLERA</p>
          <button className="btn-primary-large" onClick={() => window.location.href = '/signup'}>
            Register Your Station Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>AQUA-LLERA</h3>
              <p>Empowering water stations with modern management tools</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="/login">Station Login</a></li> 
                <li><a href="/signup">Register Station</a></li>
                <li><a href="/admin">admin</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Support</h4>
              <ul>
                <li><a href="/help">Help Center</a></li>
                <li><a href="/contact">Contact Us</a></li>
                <li><a href="/docs">Documentation</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 AQUA-LLERA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;