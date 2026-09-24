import { useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function DriverDashboard() {
  const navigate = useNavigate();

  return (
    <main style={{ color: 'white' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h1>Driver Dashboard</h1>
        <nav style={{ display: 'flex', gap: '0.5rem' }} aria-label="Account actions">
          <button type="button" onClick={() => navigate('/editprofile')}>
            Edit profile
          </button>
          <LogoutButton />
        </nav>
      </header>
    </main>
  );
}

export default DriverDashboard;
