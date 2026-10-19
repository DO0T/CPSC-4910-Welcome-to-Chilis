import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './AlertSystem.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');
const IDLE_LIMIT_MS = 5 * 60 * 1000;
const WARNING_MS = 10 * 1000;
const DASHBOARD_PATHS = new Set(['/driver-dashboard', '/sponsor-dashboard', '/admin-dashboard']);
const AUTH_PATHS = new Set(['/login', '/signup', '/forgot-password', '/reset-password']);

function AlertSystem() {
  const location = useLocation();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [warningSeconds, setWarningSeconds] = useState(null);
  const token = sessionStorage.getItem('authToken');
  const showAlerts = Boolean(token) && DASHBOARD_PATHS.has(location.pathname);
  const monitorIdle = Boolean(token) && !AUTH_PATHS.has(location.pathname);

  const loadAlerts = useCallback(async () => {
    const authToken = sessionStorage.getItem('authToken');
    if (!authToken) return;
    try {
      const response = await fetch(API_BASE_URL + '/api/alerts', {
        headers: { Authorization: 'Bearer ' + authToken },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load alerts.');
      setAlerts(Array.isArray(body) ? body : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load alerts.');
    }
  }, []);

  useEffect(() => {
    if (!showAlerts) {
      setIsOpen(false);
      return;
    }
    loadAlerts();
  }, [showAlerts, location.pathname, loadAlerts]);

  useEffect(() => {
    if (!monitorIdle) {
      setWarningSeconds(null);
      return undefined;
    }
    let idleTimer;
    let countdownTimer;
    let warningEndsAt = null;

    const clearTimers = () => {
      window.clearTimeout(idleTimer);
      window.clearInterval(countdownTimer);
    };
    const logout = () => {
      clearTimers();
      const authToken = sessionStorage.getItem('authToken');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userRole');
      if (authToken) {
        fetch(API_BASE_URL + '/api/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + authToken },
          keepalive: true,
        }).catch(() => {});
      }
      navigate('/login', {
        replace: true,
        state: { message: 'You were logged out after 5 minutes of inactivity.' },
      });
    };
    const beginWarning = () => {
      warningEndsAt = Date.now() + WARNING_MS;
      setWarningSeconds(10);
      countdownTimer = window.setInterval(() => {
        const seconds = Math.max(0, Math.ceil((warningEndsAt - Date.now()) / 1000));
        setWarningSeconds(seconds);
        if (seconds === 0) logout();
      }, 200);
    };
    const onActivity = () => {
      clearTimers();
      warningEndsAt = null;
      setWarningSeconds(null);
      idleTimer = window.setTimeout(beginWarning, IDLE_LIMIT_MS);
    };
    const onVisibilityChange = () => {
      if (!document.hidden && warningEndsAt && Date.now() >= warningEndsAt) logout();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll'];
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    onActivity();

    return () => {
      clearTimers();
      events.forEach((name) => window.removeEventListener(name, onActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [monitorIdle, location.pathname, navigate]);

  if (!showAlerts && warningSeconds === null) return null;

  return (
    <>
      {showAlerts && (
        <div className="alert-center">
          <button
            className="alert-center-trigger"
            type="button"
            aria-expanded={isOpen}
            aria-controls="alert-center-panel"
            onClick={() => {
              const opening = !isOpen;
              setIsOpen(opening);
              if (opening) loadAlerts();
            }}
          >
            Alerts {alerts.length > 0 && <span className="alert-center-count">{alerts.length}</span>}
          </button>
          {isOpen && (
            <section id="alert-center-panel" className="alert-center-panel" aria-label="Alert history">
              <header className="alert-center-heading">
                <h2>Alert history</h2>
                <button type="button" aria-label="Close alerts" onClick={() => setIsOpen(false)}>×</button>
              </header>
              {error && <p role="alert">{error}</p>}
              {!error && alerts.length === 0 && <p>No alerts yet.</p>}
              <ul className="alert-center-list">
                {alerts.map((alert) => (
                  <li key={alert.id} className="alert-center-item">
                    <strong>{alert.type === 'points' ? 'Points update' : alert.type}</strong>
                    <p>{alert.message}</p>
                    <time dateTime={alert.created_at}>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(alert.created_at))}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      {warningSeconds !== null && warningSeconds > 0 && (
        <aside className="idle-warning" role="alertdialog" aria-live="assertive">
          <strong>Still there?</strong>
          <p>You will be logged out in {warningSeconds} seconds due to inactivity.</p>
          <button type="button" onClick={() => window.dispatchEvent(new Event('pointerdown'))}>
            Stay signed in
          </button>
        </aside>
      )}
    </>
  );
}

export default AlertSystem;
