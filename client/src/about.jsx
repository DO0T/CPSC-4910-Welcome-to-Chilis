import { useEffect, useState } from 'react';
import './about.css';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

function formatDate(value) {
  if (!value) return 'Not provided';

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function About() {
  const [sprints, setSprints] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAbout() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/about`, { signal: controller.signal });
        const contentType = response.headers.get('content-type') || '';
        const body = await response.text();

        if (!response.ok) {
          let message = `Unable to load project information (HTTP ${response.status}).`;
          try {
            const data = JSON.parse(body);
            message = data.message || data.error || message;
          } catch {
            // Keep the readable HTTP error when the server returns an HTML error page.
          }
          throw new Error(message);
        }

        if (!contentType.includes('application/json')) {
          throw new Error(`The about API at ${API_BASE_URL} returned HTML instead of JSON. Check that the backend is running and VITE_API_URL points to it.`);
        }

        const data = JSON.parse(body);
        if (!Array.isArray(data)) {
          throw new Error('The about API response should be a list of sprint entries.');
        }
        setSprints(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load project information.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAbout();
    return () => controller.abort();
  }, []);

  return (
    <main className="about-page">
      <div className="about-content">
        <p className="about-eyebrow">About the project</p>
        <h1 className="about-title">Welcome to Chili's</h1>
        <p className="about-intro">
        </p>

        {loading ? (
          <div className="about-message" role="status">Loading project information...</div>
        ) : error ? (
          <div className="about-message about-error" role="alert">{error}</div>
        ) : sprints.length === 0 ? (
          <div className="about-message">No sprint information has been added yet.</div>
        ) : (
          <div className="about-sprint-list">
            {sprints.map((sprint, index) => {
              const sprintName = sprint.version_number || `Sprint ${index + 1}`;
              return (
                <section
                  className="about-card"
                  aria-labelledby={`about-sprint-${sprint.id ?? index}`}
                  key={sprint.id ?? `${sprintName}-${index}`}
                >
                  <header className="about-card-header">
                    <p className="about-sprint-label">Project sprint</p>
                    <h2 className="about-product" id={`about-sprint-${sprint.id ?? index}`}>
                      {sprintName}
                    </h2>
                    <p className="about-product-name">{sprint.product_name || 'Good Driver Incentive Program'}</p>
                    <p className="about-description">
                      {sprint.product_description || 'No sprint description is available yet.'}
                    </p>
                  </header>

                  <dl className="about-details">
                    <div className="about-detail">
                      <dt>Team</dt>
                      <dd>{sprint.team_number ? `Team ${sprint.team_number}` : 'Not provided'}</dd>
                    </div>
                    <div className="about-detail">
                      <dt>Release date</dt>
                      <dd>{formatDate(sprint.release_date)}</dd>
                    </div>
                  </dl>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default About;
