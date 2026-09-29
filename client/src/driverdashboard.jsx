import { useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';

// TODO (next pass): replace MOCK_DRIVER / MOCK_ACTIVITY / MOCK_ALERTS below with a
// fetch to something like `${API_BASE_URL}/api/driver/dashboard`, following the
// same fetch + loading/error state pattern used in about.jsx.

const MOCK_DRIVER = {
  firstName: 'Alex',
  pointsBalance: 1240,
  pointsDeltaThisWeek: 40,
};

const MOCK_ACTIVITY = [
  { id: 1, date: '2026-09-20', description: 'Redeemed: Bluetooth Headset', points: -200 },
  { id: 2, date: '2026-09-18', description: 'Points awarded — safe driving bonus', points: 50 },
  { id: 3, date: '2026-09-12', description: 'Redeemed: Gas Station Gift Card', points: -150 },
  { id: 4, date: '2026-09-05', description: 'Points awarded — on-time delivery streak', points: 75 },
];

const MOCK_ALERTS = [
  { id: 1, date: '2026-09-20', message: '25 points were deducted from your account — reason: late delivery.' },
  { id: 2, date: '2026-09-18', message: '50 points were added to your account — reason: safe driving bonus.' },
];

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatPoints(points) {
  const sign = points > 0 ? '+' : '';
  return `${sign}${points} pts`;
}

function DriverDashboard() {
  const navigate = useNavigate();
  const driver = MOCK_DRIVER;

  return (
    <main className="dashboard-page">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Driver dashboard</p>
            <h1 className="dashboard-greeting">Welcome back, {driver.firstName}</h1>
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
            <h2 id="points-heading" className="dashboard-points-value">
              {driver.pointsBalance.toLocaleString()} <span className="dashboard-points-unit">pts</span>
            </h2>
            <p className="dashboard-points-delta">
              {formatPoints(driver.pointsDeltaThisWeek)} this week
            </p>
          </header>
        </section>

        <section className="dashboard-card" aria-labelledby="activity-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Recent activity</p>
            <h2 id="activity-heading">Recent Purchases</h2>
          </header>

          {MOCK_ACTIVITY.length === 0 ? (
            <p className="dashboard-message">No purchases yet.</p>
          ) : (
            <dl className="dashboard-details">
              {MOCK_ACTIVITY.map((item) => (
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
