import BrandMark from './BrandMark.jsx';
import { Link } from "react-router-dom";
import './welcome.css';
import driver from './assets/good-trucking-driver.jpg';

function Home() {
  return (
    <main className="welcome-page">
      <div className="welcome-shell">
        <header className="welcome-topbar">
          <span className="welcome-brand"><BrandMark /><span>Welcome to Chili's<small>GOOD TRUCKING</small></span></span>
          <nav aria-label="Main navigation" className="welcome-nav">
            <Link to="/about">About</Link>
            <Link className="welcome-nav-login" to="/login">Log in</Link>
          </nav>
        </header>
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div className="welcome-copy">
            <p className="welcome-kicker">A GOOD DRIVER INCENTIVE PROGRAM</p>
            <h1 id="welcome-title">Good trucking deserves <em>good rewards.</em></h1>
            <p className="welcome-intro">The road to rewards starts with good driving. Connect with sponsors, track your points, and find something worth working toward.</p>
            <div className="welcome-actions">
              <Link className="welcome-button welcome-button-primary" to="/signup">Get started <span aria-hidden="true">→</span></Link>
              <Link className="welcome-button welcome-button-secondary" to="/login">Log in</Link>
            </div>
          </div>
          <div className="welcome-image"><img src={driver} alt="Bearded truck driver standing in front of a red semi truck" /><span>GOOD DRIVING GOES A LONG WAY</span></div>
        </section>
        <section className="welcome-for" aria-label="For drivers and sponsors">
          <div><span className="welcome-number">01 / FOR DRIVERS</span><h2>Your good driving adds up.</h2><p>Track your points and explore rewards from your sponsor.</p></div>
          <div><span className="welcome-number">02 / FOR SPONSORS</span><h2>Recognize the road ahead.</h2><p>Connect with drivers and reward the habits that matter.</p></div>
        </section>
      </div>
    </main>
  );
}

export default Home;
