import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const token = sessionStorage.getItem('authToken');
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      sessionStorage.removeItem('authToken');
      navigate('/login');
    }
  };

  return (
    <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? 'Logging out…' : 'Log out'}
    </button>
  );
}

export default LogoutButton;
