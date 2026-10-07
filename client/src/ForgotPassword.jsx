import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setMessage(data.message);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "420px", margin: "4rem auto", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Forgot Password</h2>
      <p>Enter your account email to receive a password reset link.</p>
      
      {message && <div style={{ color: "green", marginBottom: "1rem" }}>{message}</div>}
      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="email" style={{ display: "block", marginBottom: "0.5rem" }}>Email Address</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.75rem", cursor: "pointer" }}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link to="/login">Back to Login</Link>
      </div>
    </div>
  );
}