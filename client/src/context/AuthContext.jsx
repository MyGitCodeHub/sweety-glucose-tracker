import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceSessionGeneration,
  setUnauthorizedHandler,
} from '../services/apiClient.js';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../services/authService.js';
import { AuthContext } from './authContextValue.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionCheckError, setSessionCheckError] = useState(null);
  const [sessionMessage, setSessionMessage] = useState(null);

  const sessionGenerationRef = useRef(0);
  const retryControllerRef = useRef(null);

  const bumpSessionGeneration = useCallback(() => {
    const nextGeneration = advanceSessionGeneration();
    sessionGenerationRef.current = nextGeneration;
    return nextGeneration;
  }, []);

  const checkSession = useCallback(
    async (signal) => {
      const checkGeneration = bumpSessionGeneration();
      setIsCheckingSession(true);
      setSessionCheckError(null);

      try {
        const currentUser = await getCurrentUser({ signal });
        if (signal?.aborted || checkGeneration !== sessionGenerationRef.current) {
          return;
        }
        setUser(currentUser);
      } catch (error) {
        if (
          error?.name === 'AbortError' ||
          signal?.aborted ||
          checkGeneration !== sessionGenerationRef.current
        ) {
          return;
        }
        setUser(null);
        if (error?.status !== 401) {
          setSessionCheckError(
            error?.message || 'Unable to verify your session. Please try again.'
          );
        }
      } finally {
        if (!signal?.aborted && checkGeneration === sessionGenerationRef.current) {
          setIsCheckingSession(false);
        }
      }
    },
    [bumpSessionGeneration]
  );

  useEffect(() => {
    const controller = new AbortController();
    checkSession(controller.signal);
    return () => {
      controller.abort();
      retryControllerRef.current?.abort();
      retryControllerRef.current = null;
    };
  }, [checkSession]);

  useEffect(() => {
    setUnauthorizedHandler((requestGeneration) => {
      if (requestGeneration !== sessionGenerationRef.current) {
        return;
      }
      bumpSessionGeneration();
      setUser(null);
      setSessionCheckError(null);
      setSessionMessage({
        type: 'error',
        text: 'Your session has expired. Please log in again.',
      });
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [bumpSessionGeneration]);

  const retrySessionCheck = useCallback(() => {
    retryControllerRef.current?.abort();
    const controller = new AbortController();
    retryControllerRef.current = controller;
    return checkSession(controller.signal);
  }, [checkSession]);

  const clearSessionMessage = useCallback(() => {
    setSessionMessage(null);
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const loggedInUser = await loginUser({ email, password });
      retryControllerRef.current?.abort();
      retryControllerRef.current = null;
      bumpSessionGeneration();
      setUser(loggedInUser);
      setIsCheckingSession(false);
      setSessionCheckError(null);
      setSessionMessage(null);
      return loggedInUser;
    },
    [bumpSessionGeneration]
  );

  const register = useCallback(async ({ name, email, password }) => {
    const createdUser = await registerUser({ name, email, password });
    return createdUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      if (error?.status !== 401) {
        throw error;
      }
    }
    retryControllerRef.current?.abort();
    retryControllerRef.current = null;
    bumpSessionGeneration();
    setUser(null);
    setIsCheckingSession(false);
    setSessionCheckError(null);
    setSessionMessage({
      type: 'info',
      text: 'You have been logged out.',
    });
  }, [bumpSessionGeneration]);

  const value = useMemo(
    () => ({
      user,
      isCheckingSession,
      sessionCheckError,
      sessionMessage,
      setSessionMessage,
      clearSessionMessage,
      retrySessionCheck,
      login,
      register,
      logout,
    }),
    [
      user,
      isCheckingSession,
      sessionCheckError,
      sessionMessage,
      clearSessionMessage,
      retrySessionCheck,
      login,
      register,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
