import { useEffect, useState } from 'react';

function EditProfile() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    profilePicture: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((currentProfile) => ({
      ...currentProfile,
      [name]: value,
    }));
  };

  const handlePictureChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setProfile((currentProfile) => ({
      ...currentProfile,
      profilePicture: URL.createObjectURL(file),
    }));
  };

  const handleRemovePicture = () => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      profilePicture: '',
    }));
  };

  useEffect(() => {
    return () => {
      if (profile.profilePicture.startsWith('blob:')) {
        URL.revokeObjectURL(profile.profilePicture);
      }
    };
  }, [profile.profilePicture]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError('Enter your current password to change it.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match.');
        return;
      }
    }

    // Connect this form to the profile update service when it is available.
    setMessage('Your profile changes are ready to be saved.');
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="profile-title">
        <h1 id="profile-title">Edit profile</h1>
        <p>Review and update your Chili&apos;s account details.</p>

        <form onSubmit={handleSubmit}>
          <section aria-labelledby="photo-title">
            <h2 id="photo-title">Profile picture</h2>

            {profile.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt="Profile preview"
                width="96"
                height="96"
              />
            ) : (
              <div aria-label="No profile picture selected">No photo</div>
            )}

            <label htmlFor="profile-picture">Change profile picture</label>
            <input
              id="profile-picture"
              name="profilePicture"
              type="file"
              accept="image/*"
              onChange={handlePictureChange}
            />

            {profile.profilePicture && (
              <button type="button" onClick={handleRemovePicture}>
                Remove picture
              </button>
            )}
          </section>

          <section aria-labelledby="details-title">
            <h2 id="details-title">Profile details</h2>

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
          </section>

          <section aria-labelledby="password-title">
            <h2 id="password-title">Change password</h2>

            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />

            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter a new password"
              autoComplete="new-password"
            />

            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
            />
          </section>

          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}

          <button type="submit">Save changes</button>
        </form>

        <a href="/profile">Cancel</a>
      </section>
    </main>
  );
}

export default EditProfile;
