import { useEffect, useState, useCallback } from 'react';
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

  // Bulk Upload state
  const [selectedFileName, setSelectedFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState('');

  const loadDashboard = useCallback(async (signal) => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sponsor/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
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
      if (!signal?.aborted) {
        setDashboard({ data, loading: false, error: '' });
      }
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) {
        setDashboard({ data: null, loading: false, error: error.message || 'Unable to load the sponsor dashboard.' });
      }
    }
  }, [navigate]);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setBulkError('');
    setBulkResult(null);

    if (!file) {
      setSelectedFileName('');
      setFileContent('');
      return;
    }

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent(String(e.target?.result || ''));
    };
    reader.onerror = () => {
      setBulkError('Could not read the selected file.');
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async (event) => {
    event.preventDefault();
    setBulkError('');
    setBulkResult(null);

    if (!fileContent.trim()) {
      setBulkError('Please choose a non-empty pipe-delimited (.txt) file or paste lines to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileContent }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Bulk upload failed.');
      }

      setBulkResult(data);
      // Reload dashboard stats and recent activity to reflect newly added drivers and points
      await loadDashboard();
    } catch (err) {
      setBulkError(err.message || 'Unable to complete bulk upload.');
    } finally {
      setIsUploading(false);
    }
  };

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

        {/* Bulk Loading Section for Sponsors */}
        <section className="dashboard-card" aria-labelledby="sponsor-bulk-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Bulk loading</p>
            <h2 id="sponsor-bulk-heading" className="sponsor-section-title">
              Bulk Load Drivers &amp; Sponsor Users
            </h2>
          </header>

          <div style={{ padding: '20px 24px', textAlign: 'left' }}>
            <div
              style={{
                marginBottom: '16px',
                fontSize: '14px',
                color: '#55768d',
                background: '#f8faf9',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid #e8efec',
              }}
            >
              Upload a pipe-delimited text file to add Drivers (<span style={{ fontFamily: 'monospace', background: '#e8f1ed', padding: '1px 5px', borderRadius: '4px' }}>D</span>),
              Sponsor users (<span style={{ fontFamily: 'monospace', background: '#e8f1ed', padding: '1px 5px', borderRadius: '4px' }}>S</span>), or update Driver points for <strong>{sponsor.companyName}</strong>.
              <br />
              <span style={{ marginTop: '6px', display: 'block' }}>
                Omit the organization name column:{' '}
                <span style={{ fontFamily: 'monospace', color: '#1f394c' }}>
                  D||FirstName|LastName|email@example.com|100|Reason
                </span>
              </span>
            </div>

            <form onSubmit={handleBulkSubmit} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label
                  htmlFor="sponsor-bulk-file"
                  style={{ display: 'block', fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}
                >
                  Select Pipe-Delimited Text File (.txt)
                </label>
                <input
                  id="sponsor-bulk-file"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileChange}
                />
                {selectedFileName && (
                  <span style={{ marginLeft: '10px', fontSize: '13px' }}>
                    Loaded: <strong>{selectedFileName}</strong>
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="sponsor-bulk-textarea"
                  style={{ display: 'block', fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}
                >
                  File Contents Preview (or paste pipe-delimited lines directly)
                </label>
                <textarea
                  id="sponsor-bulk-textarea"
                  rows={5}
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  placeholder={'D||Joe|Driver|me@email.com||\nS||Jill|Sponsor|jill@mail.com|100|New Driver\nD||Tom|Smith|tom887@gmail.com'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd9d7',
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isUploading}
                  style={{
                    border: '1px solid #29485f',
                    borderRadius: '999px',
                    background: '#29485f',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '10px 20px',
                    cursor: 'pointer',
                  }}
                >
                  {isUploading ? 'Processing File…' : 'Upload & Process File'}
                </button>
              </div>
            </form>

            {bulkError && (
              <p role="alert" style={{ marginTop: '14px', color: '#9e2525', fontWeight: 600 }}>
                {bulkError}
              </p>
            )}

            {bulkResult && (
              <div style={{ marginTop: '16px', padding: '14px', background: '#e8f1ed', borderRadius: '12px' }}>
                <strong>{bulkResult.message}</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '14px' }}>
                  <li>Total Lines Processed: {bulkResult.summary.totalLinesProcessed}</li>
                  <li>Drivers Created (Auto-Accepted): {bulkResult.summary.driversCreated}</li>
                  <li>Existing Drivers Updated: {bulkResult.summary.driversUpdated}</li>
                  <li>Sponsor Users Created: {bulkResult.summary.sponsorsCreated}</li>
                  <li>Point Transactions Applied: {bulkResult.summary.pointsTransactions}</li>
                  <li>Lines Skipped Due to Fatal Errors: {bulkResult.summary.linesSkipped}</li>
                </ul>

                {bulkResult.errors && bulkResult.errors.length > 0 && (
                  <div
                    style={{
                      marginTop: '14px',
                      background: '#fff',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e0b4b4',
                    }}
                  >
                    <strong style={{ color: '#9e2525' }}>
                      Line-by-Line Error &amp; Warning Report ({bulkResult.errors.length}):
                    </strong>
                    <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13px', color: '#9e2525' }}>
                      {bulkResult.errors.map((err, idx) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>
                          <strong>Line {err.line} [{err.type}]:</strong> {err.message}
                          <br />
                          <span
                            style={{
                              fontFamily: 'monospace',
                              background: '#fcf2f2',
                              color: '#9e2525',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '2px',
                              border: '1px solid #f2d6d6',
                            }}
                          >
                            {err.content}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-card" aria-labelledby="sponsor-applications-heading">
          <header className="dashboard-card-header">
            <p className="dashboard-eyebrow">Driver applications</p>
            <h2 id="sponsor-applications-heading" className="sponsor-section-title">Applications</h2>
          </header>
          <p className="dashboard-message">
            Application tracking is not available yet. Drivers need a way to apply before applications can appear here.
          </p>
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