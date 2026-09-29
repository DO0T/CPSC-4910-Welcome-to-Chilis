import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    
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
        if (data.role === "Admin") navigate("/admin-dashboard");
        else if (data.role === "Sponsor") navigate("/sponsor-dashboard");
        else if (data.role === "Driver") navigate("/driver-dashboard");
      } else {
        alert(data.message); 
      }
    } catch (error) {
      console.error("Login request failed:", error);
      alert("An error occurred while attempting to log in.");
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Welcome back</h1>
        <p>Sign in to your account.</p>

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
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"} Password
          </button>

          <button type="submit">Log in</button>
        </form>

        <a href="/forgot-password">Forgot your password?</a>
        <p>
          Don&apos;t have an account? <a href="/signup">Sign up</a>
        </p>
      </section>
    </main>
  );
}

export default Login;
