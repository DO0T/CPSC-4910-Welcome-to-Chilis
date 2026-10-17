import { useNavigate } from 'react-router-dom';

/** Reusable account navigation button for returning to the active role's dashboard. */
function DashboardButton({ label = 'Dashboard', className = '' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    const role = sessionStorage.getItem('userRole');
    if (role === 'Admin') navigate('/admin-dashboard');
    else if (role === 'Sponsor') navigate('/sponsor-dashboard');
    else navigate('/driver-dashboard');
  };

  return (
    <button
      className={`dashboard-button ${className}`.trim()}
      type="button"
      onClick={handleClick}
    >
      {label}
    </button>
  );
}

export default DashboardButton;