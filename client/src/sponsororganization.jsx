import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';
import './sponsordashboard.css';
import './sponsordrivers.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function SponsorOrganization() {
  const navigate = useNavigate();
  const [info, setInfo] = useState({ data: null, loading: true, error: '' });
  const [form, setForm] = useState({ companyName: '', pointValue: '' });
  const [notice, setNotice] = useState({ text: '', error: false });
  const [saving, setSaving] = useState(false);
  const [policyDays, setPolicyDays] = useState('0');
  const [policyNotice, setPolicyNotice] = useState('');

  const loadInfo = useCallback(async () => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/sponsor/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load your sponsor info.');
      const policyResponse = await fetch(`${API_BASE_URL}/api/sponsor/policy`, { headers: { Authorization: `Bearer ${token}` } });
      const policy = await policyResponse.json();
      if (!policyResponse.ok) throw new Error(policy.message || 'Unable to load point policy.');
      setPolicyDays(String(policy.days));
      setInfo({ data, loading: false, error: '' });
      setForm({
        companyName: data.organization.companyName,
        pointValue: String(data.organization.pointValue),
      });
    } catch (error) {
      setInfo({ data: null, loading: false, error: error.message });
    }
  }, [navigate]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setNotice({ text: '', error: false });
    try {
      const response = await fetch(`${API_BASE_URL}/api/sponsor/organization`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName: form.companyName, pointValue: Number(form.pointValue) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save your sponsor info.');
      setNotice({ text: data.message, error: false });
      await loadInfo();
    } catch (error) {
      setNotice({ text: error.message, error: true });
    } finally {
      setSaving(false);
    }
  }

  async function savePolicy(event) {
    event.preventDefault();
    setPolicyNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/sponsor/policy`, {
        method: 'PUT', headers: { Authorization: `Bearer ${sessionStorage.getItem('authToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: Number(policyDays) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save policy.');
      setPolicyNotice(data.message);
    } catch (error) { setPolicyNotice(error.message); }
  }

  if (info.loading || info.error) {
    return (
      <main className="dashboard-page sponsor-dashboard">
        <div className="dashboard-content">
          <p className="dashboard-message" role={info.error ? 'alert' : 'status'}>
            {info.error ? <>{info.error} <Link to="/sponsor-dashboard">Back to dashboard</Link></> : 'Loading your sponsor info…'}
          </p>
        </div>
      </main>
    );
  }

  const { organization, teammates, user } = info.data;

  return (
    <main className="dashboard-page sponsor-dashboard">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Sponsor info</p>
            <h1 className="dashboard-greeting">{organization.companyName}</h1>
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

        <section className="dashboard-card" aria-labelledby="org-overview-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Review</p>
            <h2 id="org-overview-heading" className="sponsor-section-title">Organization details</h2>
          </header>
          <dl className="sponsor-stats">
            <div className="sponsor-stat">
              <dt>Point value</dt>
              <dd>${organization.pointValue.toFixed(2)}</dd>
            </div>
            <div className="sponsor-stat">
              <dt>Drivers</dt>
              <dd>{organization.driverCount.toLocaleString()}</dd>
            </div>
            <div className="sponsor-stat">
              <dt>Sponsor users</dt>
              <dd>{organization.sponsorUserCount.toLocaleString()}</dd>
            </div>
            <div className="sponsor-stat">
              <dt>Signed in as</dt>
              <dd className="sponsor-stat-unavailable">{user?.name} ({user?.email})</dd>
            </div>
          </dl>
        </section>

        <section className="dashboard-card" aria-labelledby="org-edit-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Update</p>
            <h2 id="org-edit-heading" className="sponsor-section-title">Edit sponsor info</h2>
            <p className="dashboard-section-description">
              The point value sets how many dollars one point is worth, which changes every catalog item&apos;s point cost.
              To change your own name, email, or password, use <Link to="/editprofile">Edit profile</Link>.
            </p>
          </header>
          <form className="sponsor-form" onSubmit={handleSubmit}>
            <div className="sponsor-form-field">
              <label htmlFor="org-company-name">Company name</label>
              <input id="org-company-name" type="text" required maxLength={255} value={form.companyName}
                onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
            </div>
            <div className="sponsor-form-field">
              <label htmlFor="org-point-value">Dollar value per point</label>
              <input id="org-point-value" type="number" required min="0.01" step="0.01" value={form.pointValue}
                onChange={(event) => setForm({ ...form, pointValue: event.target.value })} />
            </div>
            <div className="sponsor-form-footer">
              <button type="submit" className="sponsor-primary-button" disabled={saving}>
                {saving ? 'Saving…' : 'Save sponsor info'}
              </button>
            </div>
          </form>
        </section>

        <section className="dashboard-card" aria-labelledby="policy-heading">
          <header className="dashboard-card-header">
            <h2 id="policy-heading">Points after removal</h2>
            <p>Set the number of days future removed drivers may use their remaining points. Enter 0 to prevent use. Changes do not alter existing removal periods.</p>
          </header>
          <form className="sponsor-form" onSubmit={savePolicy}>
            <div className="sponsor-form-field">
              <label htmlFor="policy-days">Days after removal</label>
              <input id="policy-days" type="number" min="0" max="3650" step="1" required value={policyDays} onChange={event => setPolicyDays(event.target.value)} />
            </div>
            <button type="submit" className="sponsor-primary-button">Save point policy</button>
            {policyNotice && <p role="status">{policyNotice}</p>}
          </form>
        </section>

        <section className="dashboard-card" aria-labelledby="org-team-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Team</p>
            <h2 id="org-team-heading" className="sponsor-section-title">Sponsor users</h2>
          </header>
          <ul className="sponsor-list">
            {teammates.map((teammate) => (
              <li className="sponsor-list-item" key={teammate.id}>
                <div>
                  <span className="sponsor-list-title">{teammate.name}</span>
                  <span className="sponsor-list-detail">{teammate.email}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default SponsorOrganization;