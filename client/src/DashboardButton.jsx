import { useNavigate } from 'react-router-dom';

/** Reusable account navigation button for returning to the driver dashboard. */
function DashboardButton({ label = 'Dashboard', className = '' }) {
  const navigate = useNavigate();

  return (
    <button
      className={`dashboard-button ${className}`.trim()}
      type="button"
      onClick={() => navigate('/driver-dashboard')}
    >
      {label}
    </button>
  );
}

export default DashboardButton;
