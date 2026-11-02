import { Link } from "react-router-dom";
import './welcome.css';

function Home() {
  return (
    <main className="welcome-page">
      <div className="welcome-shell">
        <header className="welcome-topbar">
          <span className="welcome-brand">Welcome to Chili's</span>
          <nav aria-label="Main navigation" className="welcome-nav">
            <Link to="/about">About</Link>
            <Link className="welcome-nav-login" to="/login">Login</Link>
          </nav>
        </header>
        <section className="welcome-card" aria-labelledby="welcome-title">
          <div className="welcome-card-main">
            <p className="welcome-kicker">A place for drivers and sponsors</p>
            <h1 id="welcome-title">Welcome to Chili's.</h1>
            <p className="welcome-intro">Connect with sponsors, track your points, and explore rewards in one place.</p>
            <div className="welcome-actions">
              <Link className="welcome-button welcome-button-primary" to="/signup">Sign Up</Link>
              <Link className="welcome-button welcome-button-secondary" to="/login">Log in</Link>
            </div>
          </div>
          <div className="welcome-card-footer">
            <div><strong>Drivers</strong><span>Find sponsors and browse rewards.</span></div>
            <div><strong>Sponsors</strong><span>Connect with drivers and manage rewards.</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Home;
