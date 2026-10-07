import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

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
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/reset-password`, {
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
    <div style={{ maxWidth: "420px", margin: "4rem auto", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Set New Password</h2>
      
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