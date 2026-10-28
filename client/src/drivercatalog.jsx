import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';
import './drivercatalog.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function CatalogImage({ item }) {
  const [failed, setFailed] = useState(false);
  return item.imageUrl && !failed ? (
    <img className="driver-catalog-image" src={item.imageUrl} alt="" onError={() => setFailed(true)} />
  ) : (
    <div className="driver-catalog-image driver-catalog-image-placeholder" aria-hidden="true">Reward</div>
  );
}

function DriverCatalog() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return undefined;
    }

    const controller = new AbortController();
    async function loadCatalog() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/driver/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load the catalog.');
        setCatalog(body);
      } catch (caught) {
        if (caught.name !== 'AbortError') setError(caught.message || 'Unable to load the catalog.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadCatalog();
    return () => controller.abort();
  }, [navigate]);

  return (
    <main className="dashboard-page driver-catalog">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Driver catalog</p>
            <h1 className="dashboard-greeting">{catalog ? `${catalog.companyName} rewards` : 'Rewards catalog'}</h1>
          </div>
          <nav className="dashboard-nav" aria-label="Catalog navigation">
            <Link className="driver-catalog-nav-link" to="/driver-dashboard">Dashboard</Link>
            <LogoutButton />
          </nav>
        </header>

        <section className="dashboard-card" aria-labelledby="driver-catalog-heading">
          <header className="dashboard-card-header">
            <h2 id="driver-catalog-heading">Available rewards</h2>
            <p className="dashboard-section-description">Items selected by your current sponsor.</p>
          </header>
          {loading ? (
            <p className="dashboard-message" role="status">Loading rewards…</p>
          ) : error ? (
            <p className="dashboard-message" role="alert">{error} <Link to="/driver-dashboard">Back to dashboard</Link></p>
          ) : catalog.items.length === 0 ? (
            <p className="dashboard-message">This sponsor has no available rewards yet. Check back later or choose another sponsor on your dashboard.</p>
          ) : (
            <ul className="driver-catalog-list">
              {catalog.items.map((item) => (
                <li className="driver-catalog-item" key={item.id}>
                  <CatalogImage item={item} />
                  <div>
                    <h3>{item.title}</h3>
                    <p className="driver-catalog-points">
                      {item.pointCost == null ? 'Point cost unavailable' : `${item.pointCost.toLocaleString()} pts`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {!loading && !error && catalog?.items.length > 0 && (
          <p className="driver-catalog-note">Listings come from your sponsor’s saved catalog. Availability may change.</p>
        )}
      </div>
    </main>
  );
}

export default DriverCatalog;
