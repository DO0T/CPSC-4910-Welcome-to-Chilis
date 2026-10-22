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
// Mock alerts now serves as back-up data in case the API call fails, so that the card can still be displayed.
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
  const [sponsors, setSponsors] = useState({ data: [], loading: true, error: '' });
  const [submittingSponsorId, setSubmittingSponsorId] = useState(null);
  const [applicationNotice, setApplicationNotice] = useState({ text: '', error: false });

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
    const sponsorsController = new AbortController();

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

    async function loadSponsors() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/driver/applications/sponsors`, {
          headers: authHeaders,
          signal: sponsorsController.signal,
        });
        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load sponsors.');
        setSponsors({ data: body, loading: false, error: '' });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSponsors({ data: [], loading: false, error: err.message || 'Unable to load sponsors.' });
        }
      }
    }

    loadProfile();
    loadPoints();
    loadActivity();
    loadSponsors();

    return () => {
      profileController.abort();
      pointsController.abort();
      activityController.abort();
      sponsorsController.abort();
    };
  }, [navigate]);

  async function applyToSponsor(sponsorId) {
    if (submittingSponsorId !== null) return;
    setSubmittingSponsorId(sponsorId);
    setApplicationNotice({ text: '', error: false });
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sponsorId }),
      });
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to submit your application.');
      setSponsors((current) => ({
        ...current,
        data: current.data.map((sponsor) => sponsor.sponsorId === sponsorId
          ? { ...sponsor, availability: 'pending', canApply: false }
          : sponsor),
      }));
      setApplicationNotice({ text: 'Application submitted. This sponsor can now review it.', error: false });
    } catch (err) {
      setApplicationNotice({ text: err.message || 'Unable to submit your application.', error: true });
    } finally {
      setSubmittingSponsorId(null);
    }
  }

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

        <section className="dashboard-card" aria-labelledby="driver-applications-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Sponsorships</p>
            <h2 id="driver-applications-heading">Apply to a sponsor</h2>
            <p className="dashboard-section-description">Choose an organization to request sponsorship. A sponsor must approve your application before you can join.</p>
          </header>
          {applicationNotice.text && (
            <p className={`dashboard-application-notice ${applicationNotice.error ? 'dashboard-application-error' : ''}`}
              role={applicationNotice.error ? 'alert' : 'status'}>
              {applicationNotice.text}
            </p>
          )}
          {sponsors.loading ? (
            <p className="dashboard-message">Loading sponsors…</p>
          ) : sponsors.error ? (
            <p className="dashboard-message" role="alert">{sponsors.error}</p>
          ) : sponsors.data.length === 0 ? (
            <p className="dashboard-message">No sponsors are available yet.</p>
          ) : (
            <ul className="dashboard-sponsor-list">
              {sponsors.data.map((sponsor) => (
                <li className="dashboard-sponsor-item" key={sponsor.sponsorId}>
                  <div>
                    <h3>{sponsor.companyName}</h3>
                    <p className="dashboard-sponsor-status">
                      {sponsor.availability === 'pending' ? 'Application pending'
                        : sponsor.availability === 'sponsored' ? 'Your current sponsor'
                          : sponsor.availability === 'approved' ? 'Application approved'
                            : sponsor.availability === 'cooldown' ? 'Reapply 30 days after your denial'
                              : 'Open for applications'}
                    </p>
                  </div>
                  <button type="button" onClick={() => applyToSponsor(sponsor.sponsorId)}
                    disabled={!sponsor.canApply || submittingSponsorId !== null}>
                    {submittingSponsorId === sponsor.sponsorId ? 'Applying…' : 'Apply to sponsor'}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
