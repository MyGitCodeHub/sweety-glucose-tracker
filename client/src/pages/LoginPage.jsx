import { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertBanner } from '../components/AlertBanner.jsx';
import { useAuth } from '../context/useAuth.js';
import { getSafeInternalRedirect } from '../utils/navigation.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

function validateLoginFields(email, password) {
  const errors = {};
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    errors.email = 'Please enter your email address.';
  } else if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Please enter your password.';
  }

  return errors;
}

export function LoginPage() {
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const formId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [signupBanner, setSignupBanner] = useState(
    location.state?.signupSuccess || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputId = `${formId}-email`;
  const emailErrorId = `${formId}-email-error`;
  const passwordInputId = `${formId}-password`;
  const passwordErrorId = `${formId}-password-error`;

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');
    setSignupBanner('');
    clearSessionMessage();

    const errors = validateLoginFields(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      });
      const destination = getSafeInternalRedirect(location.state?.from, '/');
      navigate(destination, { replace: true });
    } catch (error) {
      setServerError(error?.message || 'Unable to log in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <main className="auth-card">
        <div className="auth-brand">
          <span className="brand-wordmark">Sweety</span>
        </div>

        <h1 className="auth-title">Log in</h1>
        <p className="auth-subtitle">
          Track your daily blood glucose readings and review summary reports.
        </p>

        <div className="form-stack">
          {signupBanner ? (
            <AlertBanner
              type="success"
              message={signupBanner}
              onDismiss={() => setSignupBanner('')}
            />
          ) : null}

          {!signupBanner && sessionMessage ? (
            <AlertBanner
              type={sessionMessage.type}
              message={sessionMessage.text}
              onDismiss={clearSessionMessage}
            />
          ) : null}

          {serverError ? (
            <AlertBanner type="error" message={serverError} />
          ) : null}

          <form onSubmit={handleSubmit} className="form-stack" noValidate>
            <div className="form-field">
              <label htmlFor={emailInputId} className="field-label">
                Email
              </label>
              <input
                id={emailInputId}
                name="email"
                type="email"
                autoComplete="email"
                className={`field-input ${fieldErrors.email ? 'field-input--error' : ''}`}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: '' }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                disabled={isSubmitting}
              />
              {fieldErrors.email ? (
                <p id={emailErrorId} className="field-error" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor={passwordInputId} className="field-label">
                Password
              </label>
              <div className="password-row">
                <input
                  id={passwordInputId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`field-input ${fieldErrors.password ? 'field-input--error' : ''}`}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id={passwordErrorId} className="field-error" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          New to Sweety? <Link to="/register">Create an account</Link>
        </p>
      </main>
    </div>
  );
}
