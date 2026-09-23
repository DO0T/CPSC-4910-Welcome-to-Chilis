import { useState } from 'react';

function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, profilePictureUrl }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to create your account.');
        return;
      }

      setSuccess('Account created. You can now log in.');
      setName('');
      setEmail('');
      setProfilePictureUrl('');
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      console.error('Signup request failed:', requestError);
      setError('Could not reach the server. Please try again.');
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="signup-title">
        <h1 id="signup-title">Create your account</h1>
        <p>Sign up for your Chili&apos;s account.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="profile-picture-url">Profile picture URL (optional)</label>
          <input
            id="profile-picture-url"
            name="profilePictureUrl"
            type="url"
            value={profilePictureUrl}
            onChange={(event) => setProfilePictureUrl(event.target.value)}
            placeholder="https://example.com/photo.jpg"
            autoComplete="url"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            autoComplete="new-password"
            required
          />

          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            required
          />

          {error && <p role="alert">{error}</p>}
          {success && <p role="status">{success}</p>}

          <button type="submit">Sign up</button>
        </form>

        <p>
          Already have an account? <a href="/login">Log in</a>
        </p>
      </section>
    </main>
  );
}

export default SignUp;
