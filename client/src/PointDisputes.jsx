import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './driverdashboard.css';
import './admindashboard.css';
import './PointDisputes.css';

const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

export default function PointDisputes() {
  const [role, setRole] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [removals, setRemovals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pointId, setPointId] = useState('');
  const [opening, setOpening] = useState('');
  const [reply, setReply] = useState('');
  const [preference, setPreference] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState('updated');
  const [loading, setLoading] = useState(true);
  const request = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('authToken');
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Request failed.');
    return body;
  }, []);
  const refresh = useCallback(
    async (userRole) => {
      const list = await request('/api/point-disputes');
      setDisputes(list);
      if (userRole === 'Driver') setRemovals(await request('/api/point-disputes/removals'));
    },
    [request],
  );
  useEffect(() => {
    (async () => {
      try {
        const session = await request('/api/session');
        setRole(session.role);
        await refresh(session.role);
        if (session.role === 'Sponsor')
          setPreference((await request('/api/point-disputes/preferences')).driverReplyEnabled);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, request]);
  async function selectDispute(id) {
    try {
      setError('');
      setSelected(id);
      setMessages(await request(`/api/point-disputes/${id}/messages`));
    } catch (e) {
      setError(e.message);
    }
  }
  async function action(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const current = disputes.find((d) => d.dispute_id === selected);
  const visibleDisputes = disputes
    .filter(
      (d) =>
        (statusFilter === 'ALL' || d.status === statusFilter) &&
        [d.dispute_id, d.driver_name, d.driver_email, d.company_name, d.reason].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        ),
    )
    .sort((a, b) =>
      sort === 'oldest'
        ? new Date(a.created_at) - new Date(b.created_at)
        : sort === 'driver'
          ? (a.driver_name || '').localeCompare(b.driver_name || '')
          : sort === 'sponsor'
            ? (a.company_name || '').localeCompare(b.company_name || '')
            : sort === 'points'
              ? a.point_change - b.point_change
              : new Date(b.updated_at) - new Date(a.updated_at),
    );
  const back =
    role === 'Sponsor'
      ? '/sponsor-dashboard'
      : role === 'Admin'
        ? '/admin-dashboard'
        : '/driver-dashboard';
  return (
    <main className="dashboard-page disputes-page">
      <div className="disputes-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">
              {role === 'Admin'
                ? 'System administration'
                : role === 'Sponsor'
                  ? 'Sponsor dashboard'
                  : 'Driver dashboard'}
            </p>
            <h1 className="dashboard-greeting">Point disputes</h1>
            <p className="dashboard-section-description">
              Review point removals and keep track of dispute conversations.
            </p>
          </div>
          <Link className="disputes-back" to={back}>
            ← Back to dashboard
          </Link>
        </header>
        {error && (
          <p role="alert" className="disputes-error">
            {error}
          </p>
        )}
        {role === 'Driver' && (
          <section className="dashboard-card disputes-card">
            <header className="dashboard-card-header">
              <p className="dashboard-eyebrow">Point activity</p>
              <h2>Open a dispute</h2>
              <p className="dashboard-section-description">
                Choose a point removal and explain what you would like your sponsor to review.
              </p>
            </header>
            <div className="disputes-card-body">
              {removals.length === 0 ? (
                <p>No undisputed sponsor point removals are available.</p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    action(async () => {
                      const result = await request('/api/point-disputes', {
                        method: 'POST',
                        body: JSON.stringify({ pointId, message: opening }),
                      });
                      setPointId('');
                      setOpening('');
                      await refresh(role);
                      await selectDispute(result.disputeId);
                    });
                  }}
                >
                  <label>
                    Point removal{' '}
                    <select required value={pointId} onChange={(e) => setPointId(e.target.value)}>
                      <option value="">Select a removal</option>
                      {removals.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.company_name}: {p.point_change} points — {p.reason} (
                          {new Date(p.transaction_date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Why are you disputing this removal?{' '}
                    <textarea
                      required
                      maxLength={4000}
                      value={opening}
                      onChange={(e) => setOpening(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Open dispute</button>
                </form>
              )}
            </div>
          </section>
        )}
        {role === 'Sponsor' && (
          <section className="disputes-card">
            <label>
              <input
                type="checkbox"
                checked={preference}
                disabled={busy}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  action(async () => {
                    await request('/api/point-disputes/preferences', {
                      method: 'PUT',
                      body: JSON.stringify({ driverReplyEnabled: enabled }),
                    });
                    setPreference(enabled);
                  });
                }}
              />{' '}
              Notify me when a driver replies to a dispute
            </label>
            <p>New disputes always generate a notification.</p>
          </section>
        )}
        <section className="admin-card disputes-card">
          <header className="admin-card-header">
            <div>
              <p className="admin-eyebrow">Dispute directory</p>
              <h2>{role === 'Driver' ? 'My disputes' : 'Point disputes'}</h2>
            </div>
            <div className="admin-filter-bar">
              <input
                type="search"
                aria-label="Search disputes"
                placeholder="Search name, email, sponsor, or reason…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DENIED">Denied</option>
              </select>
              <select
                aria-label="Sort disputes"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="updated">Recently updated</option>
                <option value="oldest">Oldest first</option>
                <option value="driver">Driver name</option>
                <option value="sponsor">Sponsor</option>
                <option value="points">Points removed</option>
              </select>
            </div>
          </header>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Sponsor</th>
                  <th>Removal</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6">Loading disputes…</td>
                  </tr>
                ) : visibleDisputes.length === 0 ? (
                  <tr>
                    <td colSpan="6">No matching disputes found.</td>
                  </tr>
                ) : (
                  visibleDisputes.map((d) => (
                    <tr key={d.dispute_id}>
                      <td>
                        <div className="admin-user-cell">
                          {d.driver_picture_url ? (
                            <img src={d.driver_picture_url} alt="" className="admin-avatar" />
                          ) : (
                            <div className="admin-avatar-placeholder">
                              {d.driver_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <div className="admin-user-name">{d.driver_name}</div>
                            <div className="admin-user-email">{d.driver_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{d.company_name}</td>
                      <td>
                        <strong>{d.point_change} pts</strong>
                        <div className="admin-user-email">{d.reason}</div>
                      </td>
                      <td>
                        <span className={`dispute-status dispute-status-${d.status.toLowerCase()}`}>
                          {d.status}
                        </span>
                      </td>
                      <td>{new Date(d.updated_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn-small"
                          onClick={() => selectDispute(d.dispute_id)}
                          aria-pressed={selected === d.dispute_id}
                        >
                          {selected === d.dispute_id ? 'Selected' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        {current && (
          <section className="disputes-card">
            <h2>
              Dispute #{current.dispute_id}: {current.status}
            </h2>
            <p>
              {current.driver_name} · {current.company_name} · {current.point_change} points
            </p>
            <p>Removal reason: {current.reason}</p>
            <h3>Conversation</h3>
            <ol className="disputes-messages">
              {messages.map((m) => (
                <li key={m.message_id}>
                  <strong>{m.author_name}</strong>{' '}
                  <time>{new Date(m.created_at).toLocaleString()}</time>
                  <p>{m.message}</p>
                </li>
              ))}
            </ol>
            {current.status === 'OPEN' && role !== 'Admin' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    await request(`/api/point-disputes/${selected}/messages`, {
                      method: 'POST',
                      body: JSON.stringify({ message: reply }),
                    });
                    setReply('');
                    await selectDispute(selected);
                    await refresh(role);
                  });
                }}
              >
                <label>
                  Message{' '}
                  <textarea
                    required
                    maxLength={4000}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </label>
                <button disabled={busy}>Send message</button>
              </form>
            )}
            {current.status === 'OPEN' && role === 'Sponsor' && (
              <>
                <p>Accepting restores the full {Math.abs(current.point_change)} points removed.</p>
                <div className="disputes-actions">
                  {['ACCEPTED', 'DENIED'].map((status) => (
                    <button
                      key={status}
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await request(`/api/point-disputes/${selected}/decision`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status }),
                          });
                          await refresh(role);
                        })
                      }
                    >
                      {status === 'ACCEPTED' ? 'Accept dispute' : 'Deny dispute'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
