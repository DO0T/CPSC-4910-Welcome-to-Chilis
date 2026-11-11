import SmartList from './SmartList.jsx';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';
import './sponsordashboard.css';
import './sponsordrivers.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

const EMPTY_POINT_FORM = { driverId: '', direction: 'add', amount: '', reason: '' };
const EMPTY_DRIVER_FORM = { name: '', email: '', password: '' };

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function dollars(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

function SponsorDrivers() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState({ data: [], loading: true, error: '' });
  const [search, setSearch] = useState('');
  const [details, setDetails] = useState(null);
  const [pointForm, setPointForm] = useState(EMPTY_POINT_FORM);
  const [driverForm, setDriverForm] = useState(EMPTY_DRIVER_FORM);
  const [notice, setNotice] = useState({ text: '', error: false });
  const [busy, setBusy] = useState('');
  const [dialogType, setDialogType] = useState('');
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!dialogType || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [dialogType]);

  const api = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      throw new Error('Please log in to continue.');
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (response.status === 401) {
      sessionStorage.removeItem('authToken');
      navigate('/login', { replace: true });
      throw new Error('Your session expired. Please log in again.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'Request failed.');
    return data;
  }, [navigate]);

  const loadDrivers = useCallback(async () => {
    try {
      const data = await api('/api/sponsor/drivers');
      setDrivers({ data, loading: false, error: '' });
    } catch (error) {
      setDrivers({ data: [], loading: false, error: error.message });
    }
  }, [api]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  async function loadDetails(driverId) {
    setDetails({ id: driverId, loading: true, data: null, error: '' });
    try {
      const data = await api(`/api/sponsor/drivers/${driverId}`);
      setDetails((current) => (current?.id === driverId ? { id: driverId, loading: false, data, error: '' } : current));
    } catch (error) {
      setDetails((current) => (current?.id === driverId
        ? { id: driverId, loading: false, data: null, error: error.message } : current));
    }
  }

  function toggleDetails(driverId) {
    if (details?.id === driverId) setDetails(null);
    else loadDetails(driverId);
  }

  function startPointChange(driver) {
    setPointForm({ ...EMPTY_POINT_FORM, driverId: String(driver.id) });
    setNotice({ text: '', error: false });
    setDialogType('points');
  }

  async function submitPoints(event) {
    event.preventDefault();
    const amount = Number(pointForm.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setNotice({ text: 'Enter a whole number of points greater than 0.', error: true });
      return;
    }
    if (!pointForm.reason.trim()) {
      setNotice({ text: 'A reason is required for every point change.', error: true });
      return;
    }

    const driverId = Number(pointForm.driverId);
    const change = pointForm.direction === 'deduct' ? -amount : amount;
    const driver = drivers.data.find((item) => item.id === driverId);
    setBusy('points');
    setNotice({ text: '', error: false });
    try {
      const data = await api('/api/driver-points', {
        method: 'POST',
        body: JSON.stringify({ driver_id: driverId, point_change: change, reason: pointForm.reason.trim() }),
      });
      setNotice({
        text: `${change > 0 ? 'Added' : 'Deducted'} ${amount.toLocaleString()} points ${change > 0 ? 'to' : 'from'} ${driver?.name || 'the driver'}. New balance: ${Number(data.total_points).toLocaleString()} pts.`,
        error: false,
      });
      setPointForm(EMPTY_POINT_FORM);
      setDialogType('');
      await loadDrivers();
      if (details?.id === driverId) await loadDetails(driverId);
    } catch (error) {
      setNotice({ text: error.message, error: true });
    } finally {
      setBusy('');
    }
  }

  async function submitNewDriver(event) {
    event.preventDefault();
    setBusy('add-driver');
    setNotice({ text: '', error: false });
    try {
      const data = await api('/api/sponsor/drivers', {
        method: 'POST',
        body: JSON.stringify(driverForm),
      });
      setNotice({ text: `${data.message}. Share the temporary password with them so they can log in.`, error: false });
      setDriverForm(EMPTY_DRIVER_FORM);
      setDialogType('');
      await loadDrivers();
    } catch (error) {
      setNotice({ text: error.message, error: true });
    } finally {
      setBusy('');
    }
  }

  async function viewAsDriver(driver) {
    setBusy(`view-${driver.id}`);
    setNotice({ text: '', error: false });
    try {
      const data = await api('/api/sponsor/impersonate', {
        method: 'POST',
        body: JSON.stringify({ driverId: driver.id }),
      });
      sessionStorage.setItem('userRole', data.role);
      navigate('/driver-dashboard');
    } catch (error) {
      setNotice({ text: error.message, error: true });
      setBusy('');
    }
  }

  const query = search.trim().toLowerCase();
  const visibleDrivers = drivers.data.filter((driver) =>
    !query || driver.name?.toLowerCase().includes(query) || driver.email?.toLowerCase().includes(query));

  return (
    <main className="dashboard-page sponsor-dashboard">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Sponsor tools</p>
            <h1 className="dashboard-greeting">Drivers &amp; points</h1>
            <p className="dashboard-section-description">Review your roster and manage driver points.</p>
          </div>
          <nav className="dashboard-nav" aria-label="Account actions">
            <Link className="sponsor-dashboard-link" to="/sponsor-dashboard">Dashboard</Link>
            <LogoutButton />
          </nav>
        </header>

        {notice.text && (
          <p className={`sponsor-tools-notice ${notice.error ? 'sponsor-tools-error' : ''}`}
            role={notice.error ? 'alert' : 'status'}>
            {notice.text}
          </p>
        )}

        <section className="dashboard-card" aria-labelledby="drivers-heading">
          <header className="dashboard-card-header sponsor-tools-header">
            <div>
              <p className="dashboard-eyebrow">Roster</p>
              <h2 id="drivers-heading" className="sponsor-section-title">Your drivers</h2>
            </div>
            <div className="sponsor-roster-controls">
            <button type="button" className="sponsor-primary-button" onClick={() => { setNotice({ text: '', error: false }); setDialogType('driver'); }}>+ Add driver</button>
            <button type="button" className="sponsor-cancel-button" onClick={() => { setNotice({ text: '', error: false }); setPointForm(EMPTY_POINT_FORM); setDialogType('points'); }}>Change points</button>
            <input type="search" className="sponsor-search" aria-label="Search drivers"
              placeholder="Search name or email…" value={search}
              onChange={(event) => setSearch(event.target.value)} />
            </div>
          </header>
          {drivers.loading ? (
            <p className="dashboard-message" role="status">Loading drivers…</p>
          ) : drivers.error ? (
            <p className="dashboard-message" role="alert">{drivers.error}</p>
          ) : visibleDrivers.length === 0 ? (
            <p className="dashboard-message">
              {drivers.data.length === 0 ? 'No drivers belong to your organization yet.' : 'No drivers match your search.'}
            </p>
          ) : (
            <SmartList items={visibleDrivers} label="drivers" options={[{key:'name',label:'Name',value:x=>x.name},{key:'email',label:'Email',value:x=>x.email},{key:'points',label:'Points',type:'number',value:x=>x.points}]}>{visibleItems => (<ul className="sponsor-list">
              {visibleItems.map((driver) => (
                <li className="sponsor-list-item sponsor-application-item" key={driver.id}>
                  <div>
                    <button type="button" className="sponsor-driver-name"
                      aria-expanded={details?.id === driver.id}
                      onClick={() => toggleDetails(driver.id)}>
                      {driver.name}
                    </button>
                    <span className="sponsor-list-detail">
                      {driver.email} · {driver.isActiveSponsor ? 'Current sponsor' : 'Member (another sponsor is active)'}
                    </span>
                  </div>
                  <div className="sponsor-driver-summary">
                    <span className={`sponsor-points ${driver.points < 0 ? 'sponsor-points-negative' : ''}`}>
                      {driver.points.toLocaleString()} pts
                      <span className="sponsor-list-detail">{dollars(driver.pointsDollarValue)}</span>
                    </span>
                    <div className="sponsor-application-actions">
                      <button type="button" className="sponsor-cancel-button" disabled={busy !== ''}
                        onClick={() => startPointChange(driver)}>
                        Change points
                      </button>
                      <button type="button" className="sponsor-approve-button" disabled={busy !== ''}
                        onClick={() => viewAsDriver(driver)}>
                        {busy === `view-${driver.id}` ? 'Switching…' : 'View as driver'}
                      </button>
                    </div>
                  </div>
                  {details?.id === driver.id && (
                    <div className="sponsor-driver-details">
                      {details.loading ? (
                        <p role="status">Loading driver information…</p>
                      ) : details.error ? (
                        <p role="alert">{details.error}</p>
                      ) : (
                        <>
                          <div className="sponsor-driver-details-content">
                            {details.data.profilePictureUrl && (
                              <img src={details.data.profilePictureUrl} alt="" className="sponsor-driver-photo"
                                onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                            )}
                            <dl>
                              <div><dt>Name</dt><dd>{details.data.name}</dd></div>
                              <div><dt>Email</dt><dd>{details.data.email}</dd></div>
                              <div><dt>Points</dt><dd>{details.data.points.toLocaleString()}</dd></div>
                            </dl>
                          </div>
                          <h3 className="sponsor-history-title">Point history with your organization</h3>
                          {details.data.pointHistory.length === 0 ? (
                            <p>No point changes yet.</p>
                          ) : (
                            <SmartList items={details.data.pointHistory} label="point history" options={[{key:'date',label:'Date',type:'date',value:x=>x.date},{key:'points',label:'Points',type:'number',value:x=>x.pointChange},{key:'reason',label:'Reason',value:x=>x.reason}]}>{visibleItems => (<ul className="sponsor-history-list">
                              {visibleItems.map((entry) => (
                                <li key={entry.id}>
                                  <span>{formatDate(entry.date)} · {entry.reason || 'Point adjustment'}</span>
                                  <strong className={entry.pointChange < 0 ? 'sponsor-points-negative' : ''}>
                                    {entry.pointChange > 0 ? '+' : ''}{entry.pointChange} pts
                                  </strong>
                                </li>
                              ))}
                            </ul>)}</SmartList>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>)}</SmartList>
          )}
        </section>

        {dialogType === 'points' && <dialog ref={dialogRef} className="admin-user-dialog sponsor-action-dialog" aria-labelledby="points-heading" onCancel={event => { event.preventDefault(); setDialogType(''); }}>
          <button className="sponsor-dialog-close" type="button" onClick={() => setDialogType('')} aria-label="Close" disabled={busy !== ''}>×</button>
        <section className="dashboard-card" aria-labelledby="points-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Incentives</p>
            <h2 id="points-heading" className="sponsor-section-title">Add or deduct points</h2>
          </header>
          {notice.error && <p className="admin-dialog-error" role="alert">{notice.text}</p>}
          {drivers.data.length === 0 && !drivers.loading ? (
            <p className="dashboard-message">You need at least one driver before you can change points.</p>
          ) : (
            <form className="sponsor-form" onSubmit={submitPoints}>
              <div className="sponsor-form-field">
                <label htmlFor="points-driver">Driver</label>
                <select id="points-driver" required value={pointForm.driverId}
                  onChange={(event) => setPointForm({ ...pointForm, driverId: event.target.value })}>
                  <option value="">Choose a driver</option>
                  {drivers.data.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({driver.email}) · {driver.points.toLocaleString()} pts
                    </option>
                  ))}
                </select>
              </div>
              <div className="sponsor-form-field">
                <label htmlFor="points-direction">Action</label>
                <select id="points-direction" value={pointForm.direction}
                  onChange={(event) => setPointForm({ ...pointForm, direction: event.target.value })}>
                  <option value="add">Add points</option>
                  <option value="deduct">Deduct points</option>
                </select>
              </div>
              <div className="sponsor-form-field">
                <label htmlFor="points-amount">Points</label>
                <input id="points-amount" type="number" min="1" step="1" required placeholder="e.g. 50"
                  value={pointForm.amount}
                  onChange={(event) => setPointForm({ ...pointForm, amount: event.target.value })} />
              </div>
              <div className="sponsor-form-field sponsor-form-wide">
                <label htmlFor="points-reason">Reason</label>
                <input id="points-reason" type="text" required maxLength={255}
                  placeholder={pointForm.direction === 'deduct' ? 'e.g. Speeding violation' : 'e.g. Safe driving bonus'}
                  value={pointForm.reason}
                  onChange={(event) => setPointForm({ ...pointForm, reason: event.target.value })} />
              </div>
              <div className="sponsor-form-footer">
                <button type="submit" className="sponsor-primary-button" disabled={busy !== ''}>
                  {busy === 'points' ? 'Saving…' : pointForm.direction === 'deduct' ? 'Deduct points' : 'Add points'}
                </button>
              </div>
            </form>
          )}
        </section>

        </dialog>}
        {dialogType === 'driver' && <dialog ref={dialogRef} className="admin-user-dialog sponsor-action-dialog" aria-labelledby="add-driver-heading" onCancel={event => { event.preventDefault(); setDialogType(''); }}>
          <button className="sponsor-dialog-close" type="button" onClick={() => setDialogType('')} aria-label="Close" disabled={busy !== ''}>×</button>
        <section className="dashboard-card" aria-labelledby="add-driver-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">New accounts</p>
            <h2 id="add-driver-heading" className="sponsor-section-title">Add a driver</h2>
            <p className="dashboard-section-description">
              Creates a driver account that already belongs to your organization. Drivers who already have an
              account should apply to your organization from their dashboard instead.
            </p>
          </header>
          {notice.error && <p className="admin-dialog-error" role="alert">{notice.text}</p>}
          <form className="sponsor-form" onSubmit={submitNewDriver}>
            <div className="sponsor-form-field">
              <label htmlFor="new-driver-name">Full name</label>
              <input id="new-driver-name" type="text" required value={driverForm.name}
                onChange={(event) => setDriverForm({ ...driverForm, name: event.target.value })} />
            </div>
            <div className="sponsor-form-field">
              <label htmlFor="new-driver-email">Email</label>
              <input id="new-driver-email" type="email" required value={driverForm.email}
                onChange={(event) => setDriverForm({ ...driverForm, email: event.target.value })} />
            </div>
            <div className="sponsor-form-field">
              <label htmlFor="new-driver-password">Temporary password</label>
              <input id="new-driver-password" type="password" required minLength={8} autoComplete="new-password"
                value={driverForm.password}
                onChange={(event) => setDriverForm({ ...driverForm, password: event.target.value })} />
            </div>
            <div className="sponsor-form-footer">
              <button type="submit" className="sponsor-primary-button" disabled={busy !== ''}>
                {busy === 'add-driver' ? 'Adding…' : 'Add driver'}
              </button>
            </div>
          </form>
        </section>
        </dialog>}
      </div>
    </main>
  );
}

export default SponsorDrivers;