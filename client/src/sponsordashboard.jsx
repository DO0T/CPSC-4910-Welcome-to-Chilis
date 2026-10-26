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
  const [confirmation, setConfirmation] = useState(null);
  const [savingApplicationId, setSavingApplicationId] = useState(null);
  const [applicationNotice, setApplicationNotice] = useState({ text: '', error: false });
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [bulkConfirmation, setBulkConfirmation] = useState(null);
  const [driverDetails, setDriverDetails] = useState(null);

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

  async function decideApplication(application, decision) {
    if (savingApplicationId !== null) return;
    setSavingApplicationId(application.applicationId);
    setApplicationNotice({ text: '', error: false });
    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/sponsor/applications/${application.applicationId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to update application.');

      setApplications((current) => ({
        ...current,
        data: current.data.filter((item) => item.applicationId !== application.applicationId),
      }));
      setConfirmation(null);
      setSelectedApplicationIds((current) => current.filter((id) => id !== application.applicationId));
      setDriverDetails((current) => current?.applicationId === application.applicationId ? null : current);
      setApplicationNotice({
        text: `${application.driverName}'s application ${decision === 'APPROVED' ? 'approved' : 'denied'}.`,
        error: false,
      });
      if (decision === 'APPROVED') {
        setDashboard((current) => ({
          ...current,
          data: current.data && typeof current.data.sponsoredDrivers === 'number'
            ? { ...current.data, sponsoredDrivers: current.data.sponsoredDrivers + 1 }
            : current.data,
        }));
      }
    } catch (error) {
      setApplicationNotice({ text: error.message || 'Unable to update application.', error: true });
    } finally {
      setSavingApplicationId(null);
    }
  }

  function toggleApplicationSelection(applicationId) {
    setBulkConfirmation(null);
    setSelectedApplicationIds((current) => current.includes(applicationId)
      ? current.filter((id) => id !== applicationId)
      : [...current, applicationId]);
  }

  async function toggleDriverDetails(applicationId) {
    if (driverDetails?.applicationId === applicationId) {
      setDriverDetails(null);
      return;
    }
    setDriverDetails({ applicationId, loading: true, data: null, error: '' });
    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/sponsor/applications/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load driver information.');
      setDriverDetails((current) => current?.applicationId === applicationId
        ? { applicationId, loading: false, data, error: '' } : current);
    } catch (error) {
      setDriverDetails((current) => current?.applicationId === applicationId
        ? { applicationId, loading: false, data: null, error: error.message || 'Unable to load driver information.' }
        : current);
    }
  }

  async function decideSelectedApplications() {
    if (!bulkConfirmation || savingApplicationId !== null) return;
    const { applicationIds, decision } = bulkConfirmation;
    setSavingApplicationId('bulk');
    setApplicationNotice({ text: '', error: false });
    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/sponsor/applications/bulk/decision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationIds, decision }),
      });
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to update applications.');

      const processedIds = new Set(applicationIds);
      setApplications((current) => ({
        ...current,
        data: current.data.filter((item) => !processedIds.has(item.applicationId)),
      }));
      setSelectedApplicationIds([]);
      setBulkConfirmation(null);
      setConfirmation(null);
      setDriverDetails((current) => processedIds.has(current?.applicationId) ? null : current);
      setApplicationNotice({
        text: `${applicationIds.length} application${applicationIds.length === 1 ? '' : 's'} ${decision === 'APPROVED' ? 'approved' : 'denied'}.`,
        error: false,
      });
      if (decision === 'APPROVED') {
        setDashboard((current) => ({
          ...current,
          data: current.data && typeof current.data.sponsoredDrivers === 'number'
            ? { ...current.data, sponsoredDrivers: current.data.sponsoredDrivers + applicationIds.length }
            : current.data,
        }));
      }
    } catch (error) {
      setApplicationNotice({ text: error.message || 'Unable to update applications.', error: true });
    } finally {
      setSavingApplicationId(null);
    }
  }

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
  const allApplicationsSelected = applications.data.length > 0 &&
    applications.data.every((application) => selectedApplicationIds.includes(application.applicationId));

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
          {applicationNotice.text && (
            <p className={`dashboard-application-notice ${applicationNotice.error ? 'dashboard-application-error' : ''}`}
              role={applicationNotice.error ? 'alert' : 'status'}>
              {applicationNotice.text}
            </p>
          )}
          {applications.loading ? (
            <p className="dashboard-message" role="status">Loading applications…</p>
          ) : applications.error ? (
            <p className="dashboard-message" role="alert">{applications.error} Try refreshing the page.</p>
          ) : applications.data.length === 0 ? (
            <p className="dashboard-message">No pending applications right now.</p>
          ) : (
            <>
              <div className="sponsor-bulk-toolbar">
                <label className="sponsor-select-all">
                  <input type="checkbox" checked={allApplicationsSelected} disabled={savingApplicationId !== null}
                    onChange={(event) => {
                      setBulkConfirmation(null);
                      setSelectedApplicationIds(event.target.checked
                        ? applications.data.map((application) => application.applicationId) : []);
                    }} />
                  Select all
                </label>
                <span>{selectedApplicationIds.length} selected</span>
                <div className="sponsor-application-actions">
                  <button type="button" className="sponsor-approve-button"
                    disabled={selectedApplicationIds.length === 0 || savingApplicationId !== null}
                    onClick={() => { setConfirmation(null); setBulkConfirmation({ applicationIds: [...selectedApplicationIds], decision: 'APPROVED' }); }}>
                    Approve selected
                  </button>
                  <button type="button" className="sponsor-deny-button"
                    disabled={selectedApplicationIds.length === 0 || savingApplicationId !== null}
                    onClick={() => { setConfirmation(null); setBulkConfirmation({ applicationIds: [...selectedApplicationIds], decision: 'DENIED' }); }}>
                    Deny selected
                  </button>
                </div>
              </div>
              {bulkConfirmation && (
                <div className="sponsor-bulk-confirmation" role="group" aria-label="Confirm bulk decision">
                  <p>{bulkConfirmation.decision === 'APPROVED' ? 'Approve' : 'Deny'} {bulkConfirmation.applicationIds.length} selected application{bulkConfirmation.applicationIds.length === 1 ? '' : 's'}?
                    {bulkConfirmation.decision === 'DENIED' && ' Drivers can reapply in 30 days.'}</p>
                  <div className="sponsor-application-actions">
                    <button type="button" className={bulkConfirmation.decision === 'APPROVED' ? 'sponsor-approve-button' : 'sponsor-deny-button'}
                      disabled={savingApplicationId !== null} onClick={decideSelectedApplications}>
                      {savingApplicationId === 'bulk' ? 'Saving…' : bulkConfirmation.decision === 'APPROVED' ? 'Confirm bulk approval' : 'Confirm bulk denial'}
                    </button>
                    <button type="button" className="sponsor-cancel-button" disabled={savingApplicationId !== null}
                      onClick={() => setBulkConfirmation(null)}>Cancel</button>
                  </div>
                </div>
              )}
              <ul className="sponsor-list">
                {applications.data.map((application) => (
                  <li className="sponsor-list-item sponsor-application-item" key={application.applicationId}>
                    <div className="sponsor-application-main">
                      <input type="checkbox" aria-label={`Select ${application.driverName}`}
                        checked={selectedApplicationIds.includes(application.applicationId)}
                        disabled={savingApplicationId !== null}
                        onChange={() => toggleApplicationSelection(application.applicationId)} />
                      <div>
                        <button type="button" className="sponsor-driver-name"
                          aria-expanded={driverDetails?.applicationId === application.applicationId}
                          aria-controls={driverDetails?.applicationId === application.applicationId
                            ? `sponsor-driver-details-${application.applicationId}` : undefined}
                          onClick={() => toggleDriverDetails(application.applicationId)}>{application.driverName}</button>
                        <span className="sponsor-list-detail">Applied {formatDate(application.appliedAt)}</span>
                      </div>
                    </div>
                    {confirmation?.applicationId === application.applicationId ? (
                      <div className="sponsor-application-confirmation">
                        <span>{confirmation.decision === 'APPROVED'
                          ? `Approve ${application.driverName}'s application?`
                          : `Deny ${application.driverName}'s application? They can reapply in 30 days.`}</span>
                        <div className="sponsor-application-actions">
                          <button type="button" className={confirmation.decision === 'APPROVED' ? 'sponsor-approve-button' : 'sponsor-deny-button'}
                            disabled={savingApplicationId !== null}
                            onClick={() => decideApplication(application, confirmation.decision)}>
                            {savingApplicationId === application.applicationId ? 'Saving…'
                              : confirmation.decision === 'APPROVED' ? 'Approve driver' : 'Deny application'}
                          </button>
                          <button type="button" className="sponsor-cancel-button"
                            disabled={savingApplicationId !== null} onClick={() => setConfirmation(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="sponsor-application-actions">
                        <button type="button" className="sponsor-approve-button" disabled={savingApplicationId !== null}
                          onClick={() => { setBulkConfirmation(null); setConfirmation({ applicationId: application.applicationId, decision: 'APPROVED' }); }}
                          aria-label={`Approve ${application.driverName}`}>Approve</button>
                        <button type="button" className="sponsor-deny-button" disabled={savingApplicationId !== null}
                          onClick={() => { setBulkConfirmation(null); setConfirmation({ applicationId: application.applicationId, decision: 'DENIED' }); }}
                          aria-label={`Deny ${application.driverName}`}>Deny</button>
                      </div>
                    )}
                    {driverDetails?.applicationId === application.applicationId && (
                      <div className="sponsor-driver-details" id={`sponsor-driver-details-${application.applicationId}`}>
                        {driverDetails.loading ? (
                          <p role="status">Loading driver information…</p>
                        ) : driverDetails.error ? (
                          <p role="alert">{driverDetails.error}</p>
                        ) : (
                          <div className="sponsor-driver-details-content">
                            {driverDetails.data.profilePictureUrl && (
                              <img src={driverDetails.data.profilePictureUrl} alt="" className="sponsor-driver-photo"
                                onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                            )}
                            <dl>
                              <div><dt>Name</dt><dd>{driverDetails.data.driverName}</dd></div>
                              <div><dt>Email</dt><dd>{driverDetails.data.email}</dd></div>
                              <div><dt>Applied</dt><dd>{formatDate(driverDetails.data.appliedAt)}</dd></div>
                            </dl>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
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
