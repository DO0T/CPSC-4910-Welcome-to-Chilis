import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

// MOCK_ALERTS is still fake data on purpose: there is no Alerts table in the
// schema yet (confirmed against sql_scripts/TableCreation.sql and the ERD), so
// there is nothing real to connect this card to without adding one. That's a
// follow-up task, not a front-end wiring problem — see the comment near the
// alerts section below for what the new table would need.
const MOCK_ALERTS = [
  { id: 1, date: '2026-09-20', message: '25 points were deducted from your account — reason: late delivery.' },
  { id: 2, date: '2026-09-18', message: '50 points were added to your account — reason: safe driving bonus.' },
];

function formatDate(value) {
  // Plain 'YYYY-MM-DD' values (like the mock alert dates) need a time appended
  // or JS parses them as UTC midnight, which can display as the previous day.
  // Real transaction_date values from MySQL already include a time, so they
  // don't need that treatment.
  const needsTime = typeof value === 'string' && value.length <= 10;
  const date = new Date(needsTime ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatPoints(points) {
  const sign = points > 0 ? '+' : '';
  return `${sign}${points} pts`;
}

function DriverDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ data: null, loading: true, error: '' });
  const [points, setPoints] = useState({ data: null, loading: true, error: '' });
  const [activity, setActivity] = useState({ data: [], loading: true, error: '' });

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return undefined;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };
    const profileController = new AbortController();
    const pointsController = new AbortController();
    const activityController = new AbortController();

    async function loadProfile() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
          headers: authHeaders,
          signal: profileController.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load your profile.');
        setProfile({ data: body, loading: false, error: '' });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setProfile({ data: null, loading: false, error: err.message || 'Unable to load your profile.' });
        }
      }
    }

    async function loadPoints() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/driver/points`, {
          headers: authHeaders,
          signal: pointsController.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || body.error || 'Unable to load your points balance.');
        setPoints({ data: body, loading: false, error: '' });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setPoints({ data: null, loading: false, error: err.message || 'Unable to load your points balance.' });
        }
      }
    }

    async function loadActivity() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/driver/points-history`, {
          headers: authHeaders,
          signal: activityController.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || body.error || 'Unable to load your recent activity.');
        setActivity({ data: body, loading: false, error: '' });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setActivity({ data: [], loading: false, error: err.message || 'Unable to load your recent activity.' });
        }
      }
    }

    loadProfile();
    loadPoints();
    loadActivity();

    return () => {
      profileController.abort();
      pointsController.abort();
      activityController.abort();
    };
  }, [navigate]);

  const firstName = profile.data?.name ? profile.data.name.split(' ')[0] : 'Driver';

  // Recent-activity rows come back shaped like the DriverPoints table
  // (point_change, reason, transaction_date). Map them to the names the
  // markup below already expects.
  const activityItems = activity.data.map((row) => ({
    id: row.id,
    date: row.transaction_date,
    description: row.reason,
    points: row.point_change,
  }));

  // Derived, not fetched: "this week" isn't its own endpoint, it's the sum of
  // point changes from the history we already have within the last 7 days.
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const pointsDeltaThisWeek = activityItems
    .filter((item) => Date.now() - new Date(item.date).getTime() <= oneWeekMs)
    .reduce((sum, item) => sum + item.points, 0);

  return (
    <main className="dashboard-page">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Driver dashboard</p>
            <h1 className="dashboard-greeting">Welcome back, {firstName}</h1>
          </div>
          <nav className="dashboard-nav" aria-label="Account actions">
            <button type="button" onClick={() => navigate('/editprofile')}>
              Edit profile
            </button>
            <LogoutButton />
          </nav>
        </header>

        <section className="dashboard-card" aria-labelledby="points-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Your balance</p>
            {points.loading ? (
              <p className="dashboard-message">Loading your balance…</p>
            ) : points.error ? (
              <p className="dashboard-message" role="alert">{points.error}</p>
            ) : (
              <>
                <h2 id="points-heading" className="dashboard-points-value">
                  {points.data.total_points.toLocaleString()} <span className="dashboard-points-unit">pts</span>
                </h2>
                <p className="dashboard-points-delta">
                  {formatPoints(pointsDeltaThisWeek)} this week
                </p>
              </>
            )}
          </header>
        </section>

        <section className="dashboard-card" aria-labelledby="activity-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Recent activity</p>
            <h2 id="activity-heading">Recent Point Activity</h2>
          </header>

          {activity.loading ? (
            <p className="dashboard-message">Loading your recent activity…</p>
          ) : activity.error ? (
            <p className="dashboard-message" role="alert">{activity.error}</p>
          ) : activityItems.length === 0 ? (
            <p className="dashboard-message">No point activity yet.</p>
          ) : (
            <dl className="dashboard-details">
              {activityItems.map((item) => (
                <div className="dashboard-detail" key={item.id}>
                  <dt>{formatDate(item.date)}</dt>
                  <dd>
                    {item.description}
                    <span className="dashboard-detail-points"> · {formatPoints(item.points)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Alerts stays on mock data — see the MOCK_ALERTS comment above for why. */}
        <section className="dashboard-card dashboard-alerts" aria-labelledby="alerts-heading">
          <header className="dashboard-card-header dashboard-alerts-header">
            <p className="dashboard-eyebrow">Alerts</p>
            <h2 id="alerts-heading">Recent Alerts</h2>
          </header>

          {MOCK_ALERTS.length === 0 ? (
            <p className="dashboard-message">You're all caught up — no new alerts.</p>
          ) : (
            <ul className="dashboard-alert-list">
              {MOCK_ALERTS.map((alert) => (
                <li className="dashboard-alert-item" key={alert.id}>
                  <span className="dashboard-alert-date">{formatDate(alert.date)}</span>
                  <span className="dashboard-alert-message">{alert.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default DriverDashboard;
