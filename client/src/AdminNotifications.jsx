import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminNotifications.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function AdminNotifications() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const token = () => sessionStorage.getItem('authToken');

  const loadNotifications = useCallback(async () => {
    const authToken = token();
    if (!authToken) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/site-notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      if (response.status === 403) {
        navigate('/admin-dashboard', { replace: true });
        return;
      }
      if (!response.ok) throw new Error(data.message || 'Could not load notices');
      setNotifications(data);
    } catch (err) {
      setError(err.message || 'Could not load notices');
    }
  }, [navigate]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    setFeedback('');

    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setError('The end time must be later than the start time.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/site-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          message,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not schedule notice');

      setMessage('');
      setStartsAt('');
      setEndsAt('');
      setFeedback(data.message);
      await loadNotifications();
    } catch (err) {
      setError(err.message || 'Could not schedule notice');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    setFeedback('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/site-notifications/${id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not delete notice');
      setFeedback(data.message);
      await loadNotifications();
    } catch (err) {
      setError(err.message || 'Could not delete notice');
    }
  };

  return (
    <main className="site-notices-page">
      <div className="site-notices-content">
        <button type="button" onClick={() => navigate('/admin-dashboard')}>
          ← Back to Admin Dashboard
        </button>
        <h1>Login Page Notices</h1>
        <p>Schedule a red banner to appear above the login form.</p>

        {error && <p className="site-notices-error" role="alert">{error}</p>}
        {feedback && <p className="site-notices-success" role="status">{feedback}</p>}

        <form className="site-notices-form" onSubmit={handleCreate}>
          <label htmlFor="notice-message">Banner message</label>
          <textarea
            id="notice-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={500}
            rows={3}
            required
          />
          <label htmlFor="notice-start">Start date and time</label>
          <input
            id="notice-start"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
          <label htmlFor="notice-end">End date and time</label>
          <input
            id="notice-end"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Schedule Notice'}
          </button>
        </form>

        <h2>Scheduled notices</h2>
        {notifications.length === 0 ? (
          <p>No notices scheduled.</p>
        ) : (
          <ul className="site-notices-list">
            {notifications.map((notice) => (
              <li key={notice.id}>
                <p>{notice.message}</p>
                <small>
                  {new Date(notice.startsAt).toLocaleString()} –{' '}
                  {new Date(notice.endsAt).toLocaleString()}
                </small>
                <button type="button" onClick={() => handleDelete(notice.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default AdminNotifications;