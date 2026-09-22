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
      <h1>Welcome to Chili's</h1>
      <p>{message}</p>
    </main>
  );
}

export default Home;