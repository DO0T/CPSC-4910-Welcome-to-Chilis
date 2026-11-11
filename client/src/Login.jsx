import BrandMark from './BrandMark.jsx';
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './welcome.css';
import './Login.css';
import cab from './assets/good-trucking-cab.jpg';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/site-notifications/active`);
        if (!response.ok) return;
        const data = await response.json();
        if (mounted) setNotifications(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Could not load login notices:', error);
      }
    };

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('authToken', data.token);
        sessionStorage.setItem('userRole', data.role);
        if (data.role === "Admin") navigate("/admin-dashboard");
        else if (data.role === "Sponsor") navigate("/sponsor-dashboard");
        else if (data.role === "Driver") navigate("/driver-dashboard");
      } else {
        // Shows "Invalid username or password" (or the no-role message) from the server
        setLoginError(data.message || "Invalid username or password");
      }
    } catch (error) {
      console.error("Login request failed:", error);
      setLoginError("Could not reach the server. Please try again.");
    }
  };

  return (
    <main className="login-page">
      <div className="login-site-alerts" aria-label="Site notifications">
        {notifications.map((notice) => (
          <div className="login-site-alert" role="status" key={notice.id}>
            {notice.message}
          </div>
        ))}
      </div>

      <div className="login-shell">
      <header className="login-topbar"><Link className="welcome-brand" to="/"><BrandMark /><span>Welcome to Chili's</span></Link><Link className="login-back" to="/">Back to home</Link></header>
      <div className="login-layout">
      <aside className="login-image-panel" aria-label="Good Trucking">
        <img src={cab} alt="Bearded truck driver sitting in the cab of a red truck" />
        <div className="login-image-caption"><span>GOOD TRUCKING</span><p>Good miles.<br />Good rewards.</p><small>Every safe trip deserves recognition.</small></div>
      </aside>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-heading">
        <p className="page-eyebrow"><span className="brand-inline"><BrandMark /> Welcome to Chili&apos;s</span></p>
        <h1 id="login-title">Welcome back</h1>
        <p className="page-subtitle">Sign in to your account.</p>
        </div>

        <div className="login-card-body">
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          {loginError && <p className="login-error" role="alert">{loginError}</p>}

          <label htmlFor="password">Password</label>
          {/* The type attribute dynamically evaluates to text or password to allow the driver to hide their password */}
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {/* Button toggles the showPassword boolean state */}
          <button
            type="button"
            className="login-password-toggle"
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"} Password
          </button>

          <button className="welcome-button welcome-button-primary login-submit" type="submit">Log in</button>
        </form>

        <Link to="/forgot-password">Forgot your password?</Link>
        <p>
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
        </div>
      </section>
      </div>
      </div>
    </main>
  );
}

export default Login;
