const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
export const MAX_BCRYPT_PASSWORD_BYTES = 72;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateRegistrationInput(body) {
  if (!isPlainObject(body)) {
    return {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request body must be a JSON object.',
      },
    };
  }

  const { name, email, password } = body;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return {
      error: {
        code: 'NAME_REQUIRED',
        message: 'Please enter your name.',
      },
    };
  }

  const trimmedName = name.trim();
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return {
      error: {
        code: 'NAME_TOO_LONG',
        message: `Name must be at most ${MAX_NAME_LENGTH} characters.`,
      },
    };
  }

  if (typeof email !== 'string' || email.trim().length === 0) {
    return {
      error: {
        code: 'EMAIL_REQUIRED',
        message: 'Please enter your email address.',
      },
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    return {
      error: {
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
      },
    };
  }

  if (typeof password !== 'string' || password.length === 0 || password.trim().length === 0) {
    return {
      error: {
        code: 'PASSWORD_REQUIRED',
        message: 'Please enter a password.',
      },
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: {
        code: 'PASSWORD_TOO_SHORT',
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      },
    };
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) {
    return {
      error: {
        code: 'PASSWORD_TOO_LONG',
        message: `Password must not exceed ${MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes.`,
      },
    };
  }

  return {
    data: {
      name: trimmedName,
      email: normalizedEmail,
      password,
    },
  };
}

export function validateLoginInput(body) {
  if (!isPlainObject(body)) {
    return {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request body must be a JSON object.',
      },
    };
  }

  const { email, password } = body;

  if (typeof email !== 'string' || email.trim().length === 0) {
    return {
      error: {
        code: 'EMAIL_REQUIRED',
        message: 'Please enter your email address.',
      },
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    return {
      error: {
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
      },
    };
  }

  if (typeof password !== 'string' || password.length === 0) {
    return {
      error: {
        code: 'PASSWORD_REQUIRED',
        message: 'Please enter your password.',
      },
    };
  }

  return {
    data: {
      email: normalizedEmail,
      password,
    },
  };
}
