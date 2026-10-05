import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './driverdashboard.css';
import './sponsordashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

// Dashboard figures are still sample data. The profile request only checks access.
const sponsor = {
  name: 'North Star Transport',
  activeDrivers: 24,
  pendingApplications: 3,
  pointsAwardedThisMonth: 1840,
};

const applications = [
  { id: 1, name: 'Jordan Lee', date: 'Oct 3, 2026', status: 'Pending review' },
  { id: 2, name: 'Taylor Morgan', date: 'Oct 2, 2026', status: 'Pending review' },
  { id: 3, name: 'Casey Rivera', date: 'Sep 30, 2026', status: 'Pending review' },
];

const pointActivity = [
  { id: 1, date: 'Oct 3', driver: 'Avery Brooks', reason: 'Safe driving bonus', points: 100 },
  { id: 2, date: 'Oct 1', driver: 'Morgan Diaz', reason: 'On-time delivery', points: 75 },
  { id: 3, date: 'Sep 29', driver: 'Sam Patel', reason: 'Late delivery', points: -25 },
];

function SponsorDashboard() {
  const navigate = useNavigate();
  const [access, setAccess] = useState('checking');

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return undefined;
    }

    const controller = new AbortController();

    async function verifySponsor() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        if (!response.ok) throw new Error('Unable to verify your account.');

        const profile = await response.json();
        if (controller.signal.aborted) return;
        if (profile.role !== 'Sponsor') {
          navigate('/', { replace: true });
          return;
        }

        setAccess('allowed');
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setAccess('error');
        }
      }
    }

    verifySponsor();
    return () => controller.abort();
  }, [navigate]);

  if (access !== 'allowed') {
    return (
      <main className="dashboard-page sponsor-dashboard">
        <div className="dashboard-content">
          <p className="dashboard-message" role={access === 'error' ? 'alert' : 'status'}>
            {access === 'error' ? (
              <>Could not verify your account. <Link to="/login">Return to login</Link>.</>
            ) : 'Checking your account…'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page sponsor-dashboard">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Sponsor dashboard</p>
            <h1 className="dashboard-greeting">{sponsor.name}</h1>
          </div>
          <span className="sponsor-demo-label">Sample data</span>
        </header>

        <section className="dashboard-card" aria-labelledby="sponsor-overview-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">At a glance</p>
            <h2 id="sponsor-overview-heading" className="sponsor-section-title">Sponsor overview</h2>
          </header>
          <dl className="sponsor-stats">
            <div className="sponsor-stat">
              <dt>Active drivers</dt>
              <dd>{sponsor.activeDrivers}</dd>
            </div>
            <div className="sponsor-stat">
              <dt>Pending applications</dt>
              <dd>{sponsor.pendingApplications}</dd>
            </div>
            <div className="sponsor-stat">
              <dt>Points awarded this month</dt>
              <dd>{sponsor.pointsAwardedThisMonth.toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <section className="dashboard-card" aria-labelledby="sponsor-applications-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Driver applications</p>
            <h2 id="sponsor-applications-heading" className="sponsor-section-title">Awaiting review</h2>
          </header>
          <ul className="sponsor-list">
            {applications.map((application) => (
              <li className="sponsor-list-item" key={application.id}>
                <div>
                  <span className="sponsor-list-title">{application.name}</span>
                  <span className="sponsor-list-detail">Applied {application.date}</span>
                </div>
                <span className="sponsor-status">{application.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-card" aria-labelledby="sponsor-activity-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Point changes</p>
            <h2 id="sponsor-activity-heading" className="sponsor-section-title">Recent activity</h2>
          </header>
          <ul className="sponsor-list">
            {pointActivity.map((item) => (
              <li className="sponsor-list-item" key={item.id}>
                <div>
                  <span className="sponsor-list-title">{item.driver}</span>
                  <span className="sponsor-list-detail">{item.date} · {item.reason}</span>
                </div>
                <span className={`sponsor-points ${item.points < 0 ? 'sponsor-points-negative' : ''}`}>
                  {item.points > 0 ? '+' : ''}{item.points} pts
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default SponsorDashboard;
