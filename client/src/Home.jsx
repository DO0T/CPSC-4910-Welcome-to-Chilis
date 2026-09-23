import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Home() {
  const [message, setMessage] = useState("Connecting to server...");

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Could not connect to the server"));
  }, []);

  return (
    <main>
      <h1>Welcome to Chili's.</h1>
      <p>{message}</p>

      <nav aria-label="Main navigation" className="home-nav">
        <Link to="/signup">Sign Up</Link>
        <Link to="/about">About</Link>
        <Link to="/login">Login</Link>
      </nav>
    </main>
  );
}

export default Home;