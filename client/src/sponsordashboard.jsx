import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';
import './sponsordashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function SponsorDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({ data: null, loading: true, error: '' });
  const [applications, setApplications] = useState({ data: [], loading: true, error: '' });

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return undefined;
    }

    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sponsor/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        if (response.status === 403) {
          navigate('/', { replace: true });
          return;
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load the sponsor dashboard.');
        if (!controller.signal.aborted) {
          setDashboard({ data, loading: false, error: '' });
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setDashboard({ data: null, loading: false, error: error.message || 'Unable to load the sponsor dashboard.' });
        }
      }
    }

    loadDashboard();
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) return undefined;

    const controller = new AbortController();

    async function loadApplications() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sponsor/applications`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }

        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load applications.');
        if (!Array.isArray(body.applications)) throw new Error('Unable to load applications.');
        if (!controller.signal.aborted) {
          setApplications({ data: body.applications, loading: false, error: '' });
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setApplications({ data: [], loading: false, error: error.message || 'Unable to load applications.' });
        }
      }
    }

    loadApplications();
    return () => controller.abort();
  }, [navigate]);

  if (dashboard.loading || dashboard.error) {
    return (
      <main className="dashboard-page sponsor-dashboard">
        <div className="dashboard-content">
          <p className="dashboard-message" role={dashboard.error ? 'alert' : 'status'}>
            {dashboard.error ? (
              <>{dashboard.error} <Link to="/login">Return to login</Link>.</>
            ) : 'Loading your sponsor dashboard…'}
          </p>
        </div>
      </main>
    );
  }

  const sponsor = dashboard.data;

  return (
    <main className="dashboard-page sponsor-dashboard">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Sponsor dashboard</p>
            <h1 className="dashboard-greeting">{sponsor.companyName}</h1>
          </div>
          <nav className="dashboard-nav" aria-label="Account actions">
            <Link className="sponsor-dashboard-link" to="/sponsor-catalog">Manage catalog</Link>
            <button type="button" onClick={() => navigate('/editprofile')}>Edit profile</button>
            <LogoutButton />
          </nav>
        </header>

        <section className="dashboard-card" aria-labelledby="sponsor-overview-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">At a glance</p>
            <h2 id="sponsor-overview-heading" className="sponsor-section-title">Sponsor overview</h2>
          </header>
          <dl className="sponsor-stats">
            <div className="sponsor-stat">
              <dt>Sponsored drivers</dt>
              <dd className={sponsor.sponsoredDrivers == null ? 'sponsor-stat-unavailable' : ''}>
                {sponsor.sponsoredDrivers == null ? 'Unavailable' : sponsor.sponsoredDrivers.toLocaleString()}
              </dd>
            </div>
            <div className="sponsor-stat">
              <dt>Points awarded this month</dt>
              <dd className={sponsor.pointsAwardedThisMonth == null ? 'sponsor-stat-unavailable' : ''}>
                {sponsor.pointsAwardedThisMonth == null ? 'Unavailable' : sponsor.pointsAwardedThisMonth.toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="dashboard-card" aria-labelledby="sponsor-applications-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Driver applications</p>
            <h2 id="sponsor-applications-heading" className="sponsor-section-title">Pending applications</h2>
          </header>
          {applications.loading ? (
            <p className="dashboard-message" role="status">Loading applications…</p>
          ) : applications.error ? (
            <p className="dashboard-message" role="alert">{applications.error} Try refreshing the page.</p>
          ) : applications.data.length === 0 ? (
            <p className="dashboard-message">No pending applications right now.</p>
          ) : (
            <ul className="sponsor-list">
              {applications.data.map((application) => (
                <li className="sponsor-list-item" key={application.applicationId}>
                  <div>
                    <span className="sponsor-list-title">{application.driverName}</span>
                    <span className="sponsor-list-detail">Applied {formatDate(application.appliedAt)}</span>
                  </div>
                  <span className="sponsor-application-status">Pending</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-card" aria-labelledby="sponsor-activity-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Point changes</p>
            <h2 id="sponsor-activity-heading" className="sponsor-section-title">Recent activity</h2>
          </header>
          {sponsor.recentActivity == null ? (
            <p className="dashboard-message">Point activity is unavailable. Check the server logs for the failed query.</p>
          ) : sponsor.recentActivity.length === 0 ? (
            <p className="dashboard-message">No point activity for this sponsor yet.</p>
          ) : (
            <ul className="sponsor-list">
              {sponsor.recentActivity.map((item) => (
                <li className="sponsor-list-item" key={item.id}>
                  <div>
                    <span className="sponsor-list-title">{item.driver}</span>
                    <span className="sponsor-list-detail">{formatDate(item.date)} · {item.reason}</span>
                  </div>
                  <span className={`sponsor-points ${item.points < 0 ? 'sponsor-points-negative' : ''}`}>
                    {item.points > 0 ? '+' : ''}{item.points} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default SponsorDashboard;
