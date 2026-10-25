import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { ENABLE_DEMO_LOGIN } from '../config.js';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage('Please provide both username/email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await login(usernameOrEmail.trim(), password);
      navigate('/');
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setUsernameOrEmail('admin@citygraph.org');
    setPassword('password123');
    setErrorMessage('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-logo-badge" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <path d="M10 6.5h4" />
              <path d="M6.5 10v4" />
              <path d="M17.5 10v4" />
              <path d="M10 17.5h4" />
            </svg>
          </div>
          <h1>CityGraph</h1>
          <p className="auth-subtitle">Urban Infrastructure Risk Intelligence</p>
        </div>

        {/* Security Notice Pill */}
        <div className="auth-security-pill">
          <span className="auth-shield-icon">🔒</span>
          <span>Authenticated Operations Access</span>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-username">Username or Email</label>
            <input
              id="login-username"
              type="text"
              className="auth-input"
              placeholder="e.g. admin or admin@citygraph.org"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <div className="label-with-action">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="btn-spinner" aria-hidden="true"></span>
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Dashboard</span>
            )}
          </button>
        </form>

        {/* Demo Fast-Login Helper (Only shown if ENABLE_DEMO_LOGIN is active) */}
        {ENABLE_DEMO_LOGIN && (
          <div className="auth-demo-box">
            <p className="demo-title">Sandbox Demo Account:</p>
            <button
              type="button"
              className="demo-autofill-btn"
              onClick={handleFillDemo}
              disabled={loading}
            >
              Fill Demo Admin Credentials (admin@citygraph.org)
            </button>
          </div>
        )}

        {/* Footer Link to Register */}
        <div className="auth-footer">
          <span>Need an analyst account?</span>{' '}
          <Link to="/register" className="auth-link">
            Register new user
          </Link>
        </div>
      </div>
    </div>
  );
}
