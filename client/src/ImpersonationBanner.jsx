import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      setImpersonating(null);
      return;
    }

    let active = true;
    fetch(`${API_BASE_URL}/api/session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setImpersonating(data.impersonating || null);
          if (data.role) {
            sessionStorage.setItem('userRole', data.role);
          }
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (!impersonating) return null;

  const handleReturnToAdmin = async () => {
    setRestoring(true);
    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/stop-impersonating`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        sessionStorage.setItem('userRole', 'Admin');
        setImpersonating(null);
        navigate('/admin-dashboard');
      }
    } catch (error) {
      console.error('Failed to exit impersonation:', error);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Admin view-as mode banner"
      style={{
        background: '#29485f',
        color: '#ffffff',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '14px',
        borderBottom: '2px solid #55768d',
      }}
    >
      <div>
        <strong>Admin View-As Mode:</strong> Currently viewing and acting as{' '}
        <strong>{impersonating.name}</strong> ({impersonating.role} · {impersonating.email})
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() =>
            navigate(
              impersonating.role === 'Sponsor'
                ? '/sponsor-dashboard'
                : '/driver-dashboard'
            )
          }
          style={{
            background: 'transparent',
            color: '#fff',
            border: '1px solid #cbd9d7',
            borderRadius: '999px',
            padding: '6px 14px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {impersonating.role} Dashboard
        </button>
        <button
          type="button"
          onClick={handleReturnToAdmin}
          disabled={restoring}
          style={{
            background: '#e8f1ed',
            color: '#29485f',
            border: 'none',
            borderRadius: '999px',
            padding: '6px 16px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          {restoring ? 'Returning…' : 'Return to Admin Panel'}
        </button>
      </div>
    </div>
  );
}

export default ImpersonationBanner;