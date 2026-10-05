import { useState } from 'react';
import { Link } from 'react-router-dom';
import './signup.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function SignUp() {
  const [role, setRole] = useState('Driver');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          name,
          companyName: role === 'Sponsor' ? companyName : undefined,
          email,
          password,
          profilePictureUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to create your account.');
        return;
      }

      setSuccess(`${role} account created. You can now log in.`);
      setName('');
      setCompanyName('');
      setEmail('');
      setProfilePictureUrl('');
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      console.error('Signup request failed:', requestError);
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="signup-page">
      <div className="signup-content">
        <header className="signup-heading">
          <p className="signup-eyebrow">Welcome to Chili&apos;s</p>
          <h1 id="signup-title">Create your account</h1>
          <p>Choose how you&apos;ll use the platform, then enter your details.</p>
        </header>

        <section className="signup-card" aria-labelledby="signup-title">
          <form onSubmit={handleSubmit}>
            <fieldset className="signup-role-fieldset">
              <legend>I&apos;m signing up as a</legend>
              <div className="signup-role-options">
                <label className={`signup-role-option ${role === 'Driver' ? 'is-selected' : ''}`}>
                  <input type="radio" name="role" value="Driver" checked={role === 'Driver'}
                    onChange={() => handleRoleChange('Driver')} />
                  <span><strong>Driver</strong><small>Track your points and activity.</small></span>
                </label>
                <label className={`signup-role-option ${role === 'Sponsor' ? 'is-selected' : ''}`}>
                  <input type="radio" name="role" value="Sponsor" checked={role === 'Sponsor'}
                    onChange={() => handleRoleChange('Sponsor')} />
                  <span><strong>Sponsor</strong><small>Manage drivers and reward activity.</small></span>
                </label>
              </div>
            </fieldset>

            <div className="signup-fields">
              <div className="signup-field">
                <label htmlFor="name">Full name</label>
                <input id="name" name="name" type="text" value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name" autoComplete="name" required />
              </div>

              {role === 'Sponsor' && (
                <div className="signup-field">
                  <label htmlFor="company-name">Company name</label>
                  <input id="company-name" name="companyName" type="text" value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Your organization" autoComplete="organization" required />
                </div>
              )}

              <div className="signup-field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com" autoComplete="email" required />
              </div>

              <div className="signup-field">
                <label htmlFor="profile-picture-url">Profile picture URL <span>(optional)</span></label>
                <input id="profile-picture-url" name="profilePictureUrl" type="url"
                  value={profilePictureUrl} onChange={(event) => setProfilePictureUrl(event.target.value)}
                  placeholder="https://example.com/photo.jpg" />
              </div>

              <div className="signup-field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password" autoComplete="new-password" required />
              </div>

              <div className="signup-field">
                <label htmlFor="confirm-password">Confirm password</label>
                <input id="confirm-password" name="confirmPassword" type="password"
                  value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password" autoComplete="new-password" required />
              </div>
            </div>

            {error && <p className="signup-feedback signup-error" role="alert">{error}</p>}
            {success && <p className="signup-feedback signup-success" role="status">{success}</p>}

            <button className="signup-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : `Create ${role.toLowerCase()} account`}
            </button>
          </form>
          <p className="signup-login">Already have an account? <Link to="/login">Log in</Link></p>
        </section>
      </div>
    </main>
  );
}

export default SignUp;
