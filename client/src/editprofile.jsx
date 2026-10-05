import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import DashboardButton from './DashboardButton.jsx';
import './editprofile.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function EditProfile() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    profilePictureUrl: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return;
    }

    let active = true;
    fetch(`${API_BASE_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            sessionStorage.removeItem('authToken');
            navigate('/login');
          }
          throw new Error(data.message || 'Could not load your profile.');
        }
        if (active) {
          setProfile({
            name: data.name || '',
            email: data.email || '',
            profilePictureUrl: data.profilePictureUrl || '',
          });
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load your profile.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [navigate]);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((currentProfile) => ({ ...currentProfile, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const changingPassword = currentPassword || newPassword || confirmPassword;
    if (changingPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('Enter your current password and fill in both new password fields.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...profile,
          currentPassword,
          newPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && data.message === 'Please log in to continue') {
          sessionStorage.removeItem('authToken');
          navigate('/login');
        }
        setError(data.message || 'Could not save your profile.');
        return;
      }

      setProfile(data.profile);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(data.message || 'Profile updated successfully.');
    } catch (requestError) {
      console.error('Profile update request failed:', requestError);
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="profile-page">
      <div className="profile-content">
        <header className="profile-topbar">
          <div>
            <p className="profile-eyebrow">Account settings</p>
            <h1 id="profile-title" className="profile-title">Edit profile</h1>
            <p className="profile-intro">Review and update your Chili&apos;s account details.</p>
          </div>
          <nav className="profile-nav" aria-label="Account actions">
            <DashboardButton />
            <LogoutButton />
          </nav>
        </header>

        {isLoading ? <p role="status">Loading your profile…</p> : (
          <form className="profile-form" onSubmit={handleSubmit}>
            <section className="profile-card" aria-labelledby="photo-title">
              <header className="profile-card-header">
                <p className="profile-eyebrow">Your account</p>
                <h2 id="photo-title">Profile picture</h2>
              </header>
              <div className="profile-card-body">
              {profile.profilePictureUrl ? (
                <img
                  src={profile.profilePictureUrl}
                  alt="Your profile"
                  width="96"
                  height="96"
                  style={{ objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <div className="profile-no-photo" aria-label="No profile picture">No photo</div>
              )}

              <label htmlFor="profile-picture-url">Profile picture URL</label>
              <input
                id="profile-picture-url"
                name="profilePictureUrl"
                type="url"
                value={profile.profilePictureUrl}
                onChange={handleProfileChange}
                placeholder="https://example.com/photo.jpg"
              />
              {profile.profilePictureUrl && (
                <button
                  type="button"
                  onClick={() => setProfile((current) => ({ ...current, profilePictureUrl: '' }))}
                >
                  Remove picture
                </button>
              )}
              </div>
            </section>

            <section className="profile-card" aria-labelledby="details-title">
              <header className="profile-card-header">
                <p className="profile-eyebrow">Personal information</p>
                <h2 id="details-title">Profile details</h2>
              </header>
              <div className="profile-card-body">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={profile.name}
                onChange={handleProfileChange}
                placeholder="Your name"
                autoComplete="name"
                required
              />

              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={profile.email}
                onChange={handleProfileChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              </div>
            </section>

            <section className="profile-card" aria-labelledby="password-title">
              <header className="profile-card-header">
                <p className="profile-eyebrow">Security</p>
                <h2 id="password-title">Change password</h2>
              </header>
              <div className="profile-card-body">
              <p>Leave these fields blank to keep your current password.</p>
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                name="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />

              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />

              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
              </div>
            </section>

            {error && <p className="profile-feedback profile-error" role="alert">{error}</p>}
            {message && <p className="profile-feedback profile-success" role="status">{message}</p>}
            <button className="profile-save-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}

      </div>
    </main>
  );
}

export default EditProfile;
