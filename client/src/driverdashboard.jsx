import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

const SPONSORS_PER_PAGE = 5;
const SPONSOR_FILTERS = [
  { value: 'all', label: 'All sponsors' },
  { value: 'available', label: 'Open for applications' },
  { value: 'pending', label: 'Application pending' },
  { value: 'sponsored', label: 'Current sponsor' },
  { value: 'approved', label: 'Approved sponsors' },
  { value: 'cooldown', label: 'Waiting to reapply' },
];

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

function formatApplicationDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function applicationDateLabel(sponsor) {
  const decided = formatApplicationDate(sponsor.decidedAt);
  if (decided) return `Updated ${decided}`;
  const applied = formatApplicationDate(sponsor.appliedAt);
  return applied ? `Applied ${applied}` : 'Application submitted';
}

function applicationNextStep(sponsor) {
  if (sponsor.applicationStatus === 'PENDING') return 'Waiting for this sponsor to review your request.';
  if (sponsor.applicationStatus === 'APPROVED') return 'This sponsor approved your application.';
  if (sponsor.canApply) return 'You can apply again now.';
  const reapplyDate = formatApplicationDate(sponsor.canReapplyAt);
  return reapplyDate ? `You can reapply on ${reapplyDate}.` : 'You can reapply 30 days after the decision.';
}

async function requestSponsors(token, signal) {
  const response = await fetch(`${API_BASE_URL}/api/driver/applications/sponsors`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 401) {
    const error = new Error('Please log in to continue.');
    error.status = 401;
    throw error;
  }
  const body = await response.json();
  if (!response.ok || !Array.isArray(body)) throw new Error(body?.message || 'Unable to load sponsors.');
  return body;
}

async function requestMemberships(token, signal) {
  const response = await fetch(`${API_BASE_URL}/api/driver/sponsorships`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 401) {
    const error = new Error('Please log in to continue.');
    error.status = 401;
    throw error;
  }
  const body = await response.json();
  if (!response.ok || !Array.isArray(body)) throw new Error(body?.message || 'Unable to load your sponsors.');
  return body;
}

function DriverDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ data: null, loading: true, error: '' });
  const [points, setPoints] = useState({ data: null, loading: true, error: '' });
  const [activity, setActivity] = useState({ data: [], loading: true, error: '' });
  const [sponsors, setSponsors] = useState({ data: [], loading: true, error: '' });
  const [memberships, setMemberships] = useState({ data: [], loading: true, error: '' });
  const [switchingSponsorId, setSwitchingSponsorId] = useState(null);
  const [switchNotice, setSwitchNotice] = useState({ text: '', error: false });
  const [checkingApplications, setCheckingApplications] = useState(false);
  const [applicationCheckError, setApplicationCheckError] = useState('');
  const [statusActionNotice, setStatusActionNotice] = useState({ text: '', error: false });
  const [submittingSponsorId, setSubmittingSponsorId] = useState(null);
  const [applicationNotice, setApplicationNotice] = useState({ text: '', error: false });
  const [sponsorSearch, setSponsorSearch] = useState('');
  const [sponsorFilter, setSponsorFilter] = useState('all');
  const [visibleSponsorCount, setVisibleSponsorCount] = useState(SPONSORS_PER_PAGE);

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
    const membershipsController = new AbortController();

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
        const body = await requestSponsors(token, sponsorsController.signal);
        setSponsors({ data: body, loading: false, error: '' });
      } catch (err) {
        if (err.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        if (err.name !== 'AbortError') {
          setSponsors({ data: [], loading: false, error: err.message || 'Unable to load sponsors.' });
        }
      }
    }

    async function loadMemberships() {
      try {
        const body = await requestMemberships(token, membershipsController.signal);
        setMemberships({ data: body, loading: false, error: '' });
      } catch (err) {
        if (err.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        if (err.name !== 'AbortError') {
          setMemberships({ data: [], loading: false, error: err.message || 'Unable to load your sponsors.' });
        }
      }
    }

    loadProfile();
    loadPoints();
    loadActivity();
    loadSponsors();
    loadMemberships();

    return () => {
      profileController.abort();
      pointsController.abort();
      activityController.abort();
      sponsorsController.abort();
      membershipsController.abort();
    };
  }, [navigate]);

  async function checkApplicationStatus() {
    if (checkingApplications || sponsors.loading) return;
    setCheckingApplications(true);
    setApplicationCheckError('');
    try {
      const body = await requestSponsors(sessionStorage.getItem('authToken'));
      setSponsors({ data: body, loading: false, error: '' });
      try {
        const memberBody = await requestMemberships(sessionStorage.getItem('authToken'));
        setMemberships({ data: memberBody, loading: false, error: '' });
      } catch (err) {
        if (err.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        setMemberships({ data: [], loading: false, error: err.message || 'Unable to load your sponsors.' });
      }
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      setApplicationCheckError(err.message || 'Unable to check application status.');
    } finally {
      setCheckingApplications(false);
    }
  }

  async function applyToSponsor(sponsorId, source = 'directory') {
    if (submittingSponsorId !== null) return;
    setSubmittingSponsorId(sponsorId);
    setApplicationNotice({ text: '', error: false });
    setStatusActionNotice({ text: '', error: false });
    const showResult = source === 'status' ? setStatusActionNotice : setApplicationNotice;
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
          ? { ...sponsor, availability: 'pending', canApply: false,
            applicationStatus: 'PENDING', appliedAt: new Date().toISOString(),
            decidedAt: null, canReapplyAt: null }
          : sponsor),
      }));
      showResult({ text: 'Application submitted. This sponsor can now review it.', error: false });
    } catch (err) {
      showResult({ text: err.message || 'Unable to submit your application.', error: true });
    } finally {
      setSubmittingSponsorId(null);
    }
  }

  async function switchSponsor(sponsorId) {
    if (switchingSponsorId !== null) return;
    setSwitchingSponsorId(sponsorId);
    setSwitchNotice({ text: '', error: false });
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/sponsorships/active`, {
        method: 'PATCH',
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
      if (!response.ok) throw new Error(body.message || 'Unable to switch sponsors.');

      setMemberships((current) => ({
        ...current,
        data: current.data.map((membership) => ({
          ...membership,
          isActive: membership.sponsorId === body.activeSponsorId,
        })),
      }));
      setSponsors((current) => ({
        ...current,
        data: current.data.map((sponsor) => {
          if (sponsor.sponsorId === body.activeSponsorId) {
            return { ...sponsor, availability: 'sponsored', canApply: false };
          }
          if (sponsor.availability === 'sponsored') {
            return { ...sponsor, availability: 'approved', canApply: false };
          }
          return sponsor;
        }),
      }));
      setSwitchNotice({ text: `${body.companyName} is now your current sponsor.`, error: false });
    } catch (err) {
      setSwitchNotice({ text: err.message || 'Unable to switch sponsors.', error: true });
    } finally {
      setSwitchingSponsorId(null);
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

  const normalizedSearch = sponsorSearch.trim().toLocaleLowerCase();
  const filteredSponsors = sponsors.data.filter((sponsor) =>
    sponsor.companyName.toLocaleLowerCase().includes(normalizedSearch) &&
    (sponsorFilter === 'all' || sponsor.availability === sponsorFilter)
  );
  const visibleSponsors = filteredSponsors.slice(0, visibleSponsorCount);
  const trackedApplications = sponsors.data
    .filter((sponsor) => ['PENDING', 'APPROVED', 'DENIED'].includes(sponsor.applicationStatus))
    .sort((a, b) => new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime());
  const pendingApplicationCount = trackedApplications.filter((sponsor) => sponsor.applicationStatus === 'PENDING').length;

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

        <section className="dashboard-card" aria-labelledby="driver-memberships-heading">
          <header className="dashboard-card-header driver-memberships-header">
            <div>
              <h2 id="driver-memberships-heading">My sponsors</h2>
              <p className="dashboard-section-description">Organizations you belong to.</p>
            </div>
            {memberships.data.some((membership) => membership.isActive) && (
              <Link className="driver-catalog-link" to="/driver-catalog">View catalog</Link>
            )}
          </header>
          {switchNotice.text && (
            <p className={`dashboard-application-notice ${switchNotice.error ? 'dashboard-application-error' : ''}`}
              role={switchNotice.error ? 'alert' : 'status'}>{switchNotice.text}</p>
          )}
          {memberships.loading ? (
            <p className="dashboard-message" role="status">Loading your sponsors…</p>
          ) : memberships.error ? (
            <p className="dashboard-message" role="alert">{memberships.error}</p>
          ) : memberships.data.length === 0 ? (
            <p className="dashboard-message">No sponsors yet. Apply to a sponsor below to get started.</p>
          ) : (
            <ul className="dashboard-sponsor-list">
              {memberships.data.map((membership) => (
                <li className="dashboard-sponsor-item driver-membership-item" key={membership.sponsorId}>
                  <h3>{membership.companyName}</h3>
                  {membership.isActive ? (
                    <span className="driver-membership-label driver-membership-active">Current sponsor</span>
                  ) : (
                    <button type="button" disabled={switchingSponsorId !== null}
                      onClick={() => switchSponsor(membership.sponsorId)}>
                      {switchingSponsorId === membership.sponsorId ? 'Switching…' : `Switch to ${membership.companyName}`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-card driver-applications-card" aria-labelledby="application-status-heading">
          <header className="dashboard-card-header driver-applications-header">
            <div>
              <p className="dashboard-eyebrow">Sponsorship requests</p>
              <h2 id="application-status-heading">Your applications</h2>
              <p className="dashboard-section-description">See where each request stands without searching the sponsor list.</p>
            </div>
            <button type="button" className="driver-check-status" onClick={checkApplicationStatus}
              disabled={checkingApplications || sponsors.loading}>
              {checkingApplications ? 'Checking…' : 'Check for updates'}
            </button>
          </header>
          {applicationCheckError && <p className="dashboard-application-notice dashboard-application-error" role="alert">{applicationCheckError}</p>}
          {statusActionNotice.text && (
            <p className={`dashboard-application-notice ${statusActionNotice.error ? 'dashboard-application-error' : ''}`}
              role={statusActionNotice.error ? 'alert' : 'status'}>{statusActionNotice.text}</p>
          )}
          {sponsors.loading ? (
            <p className="dashboard-message" role="status">Loading application status…</p>
          ) : sponsors.error ? (
            <p className="dashboard-message" role="alert">{sponsors.error}</p>
          ) : trackedApplications.length === 0 ? (
            <p className="dashboard-message">No applications yet. Browse sponsors below to get started.</p>
          ) : (
            <>
              <p className="driver-application-summary-count">
                {pendingApplicationCount === 0 ? 'No requests awaiting review'
                  : `${pendingApplicationCount} request${pendingApplicationCount === 1 ? '' : 's'} awaiting review`}
              </p>
              <ul className="driver-application-status-list">
                {trackedApplications.map((sponsor) => (
                  <li className="driver-application-status-item" key={sponsor.sponsorId}>
                    <div className="driver-application-status-top">
                      <div>
                        <h3>{sponsor.companyName}</h3>
                        <p>{applicationDateLabel(sponsor)}</p>
                      </div>
                      <span className={`driver-application-badge driver-application-badge-${sponsor.applicationStatus.toLowerCase()}`}>
                        {sponsor.applicationStatus === 'PENDING' ? 'Pending review'
                          : sponsor.applicationStatus === 'APPROVED' ? 'Approved' : 'Denied'}
                      </span>
                    </div>
                    <p className="driver-application-next-step">{applicationNextStep(sponsor)}</p>
                    {sponsor.applicationStatus === 'DENIED' && sponsor.canApply && (
                      <button type="button" className="driver-reapply-button"
                        disabled={submittingSponsorId !== null}
                        onClick={() => applyToSponsor(sponsor.sponsorId, 'status')}>
                        {submittingSponsorId === sponsor.sponsorId ? 'Applying…' : `Reapply to ${sponsor.companyName}`}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

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
            <>
              <div className="dashboard-sponsor-controls" role="search" aria-label="Find sponsors">
                <div className="dashboard-sponsor-control">
                  <label htmlFor="sponsor-search">Search sponsors</label>
                  <input id="sponsor-search" type="search" value={sponsorSearch}
                    placeholder="Search by organization name"
                    onChange={(event) => {
                      setSponsorSearch(event.target.value);
                      setVisibleSponsorCount(SPONSORS_PER_PAGE);
                    }} />
                </div>
                <div className="dashboard-sponsor-control">
                  <label htmlFor="sponsor-filter">Filter by status</label>
                  <select id="sponsor-filter" value={sponsorFilter}
                    onChange={(event) => {
                      setSponsorFilter(event.target.value);
                      setVisibleSponsorCount(SPONSORS_PER_PAGE);
                    }}>
                    {SPONSOR_FILTERS.map((filter) => (
                      <option value={filter.value} key={filter.value}>{filter.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {filteredSponsors.length === 0 ? (
                <p className="dashboard-message">No sponsors match your search or filter. Try another name or status.</p>
              ) : (
                <>
                  <p className="dashboard-sponsor-count" role="status">
                    Showing {visibleSponsors.length} of {filteredSponsors.length} sponsors
                  </p>
                  <ul className="dashboard-sponsor-list">
                    {visibleSponsors.map((sponsor) => (
                      <li className="dashboard-sponsor-item" key={sponsor.sponsorId}>
                        <div>
                          <h3>{sponsor.companyName}</h3>
                          <p className="dashboard-sponsor-status">
                            {sponsor.availability === 'pending' ? 'Application pending'
                              : sponsor.availability === 'sponsored' ? 'Your current sponsor'
                                : sponsor.availability === 'approved' ? 'Approved sponsor'
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
                  {visibleSponsorCount < filteredSponsors.length && (
                    <div className="dashboard-sponsor-more">
                      <button type="button" onClick={() => setVisibleSponsorCount((count) => count + SPONSORS_PER_PAGE)}>
                        Show more
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
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
