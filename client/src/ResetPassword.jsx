import React, { useState } from "react";
import "./password-pages.css";
import { useSearchParams, Link } from "react-router-dom";
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "http://52.23.134.146:5000");

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Missing or invalid reset token link");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      setMessage(data.message);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-page">
      <p className="page-eyebrow">Account security</p>
      <h1>Set new password</h1>
      <p className="page-subtitle">Choose a new password for your account.</p>
      
      {message && (
        <div style={{ color: "green", marginBottom: "1rem" }}>
          {message} <br />
          <Link to="/login" style={{ display: "inline-block", marginTop: "0.5rem" }}>Click here to log in</Link>
        </div>
      )}
      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      {!message && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="newPassword" style={{ display: "block", marginBottom: "0.5rem" }}>New Password</label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="confirmPassword" style={{ display: "block", marginBottom: "0.5rem" }}>Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.75rem", cursor: "pointer" }}>
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>
      )}
    </div>
  );
}