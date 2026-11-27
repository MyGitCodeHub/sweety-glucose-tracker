import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertBanner } from '../components/AlertBanner.jsx';
import { useAuth } from '../context/useAuth.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

function validateRegistrationFields(name, email, password) {
  const errors = {};
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!trimmedName) {
    errors.name = 'Please enter your name.';
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  }

  if (!normalizedEmail) {
    errors.email = 'Please enter your email address.';
  } else if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password || password.trim().length === 0) {
    errors.password = 'Please enter a password.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  } else if (new TextEncoder().encode(password).length > MAX_BCRYPT_PASSWORD_BYTES) {
    errors.password = `Password must not exceed ${MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes.`;
  }

  return errors;
}

export function RegisterPage() {
  const { register, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const formId = useId();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputId = `${formId}-name`;
  const nameErrorId = `${formId}-name-error`;
  const emailInputId = `${formId}-email`;
  const emailErrorId = `${formId}-email-error`;
  const passwordInputId = `${formId}-password`;
  const passwordHintId = `${formId}-password-hint`;
  const passwordErrorId = `${formId}-password-error`;

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');

    const errors = validateRegistrationFields(name, email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      clearSessionMessage();
      navigate('/login', {
        replace: true,
        state: {
          signupSuccess: 'Account created successfully. Please log in.',
        },
      });
    } catch (error) {
      setServerError(error?.message || 'Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const passwordDescribedBy = fieldErrors.password
    ? `${passwordHintId} ${passwordErrorId}`
    : passwordHintId;

  return (
    <div className="auth-shell">
      <main className="auth-card">
        <div className="auth-brand">
          <span className="brand-wordmark">Sweety</span>
        </div>

        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">
          Set up your personal Sweety blood glucose log.
        </p>

        <div className="form-stack">
          {serverError ? (
            <AlertBanner type="error" message={serverError} />
          ) : null}

          <form onSubmit={handleSubmit} className="form-stack" noValidate>
            <div className="form-field">
              <label htmlFor={nameInputId} className="field-label">
                Full name
              </label>
              <input
                id={nameInputId}
                name="name"
                type="text"
                autoComplete="name"
                maxLength={MAX_NAME_LENGTH}
                className={`field-input ${fieldErrors.name ? 'field-input--error' : ''}`}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: '' }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? nameErrorId : undefined}
                disabled={isSubmitting}
              />
              {fieldErrors.name ? (
                <p id={nameErrorId} className="field-error" role="alert">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

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
                  autoComplete="new-password"
                  className={`field-input ${fieldErrors.password ? 'field-input--error' : ''}`}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={passwordDescribedBy}
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
              <p id={passwordHintId} className="field-hint">
                At least 8 characters and up to 72 UTF-8 bytes.
              </p>
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
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </main>
    </div>
  );
}
