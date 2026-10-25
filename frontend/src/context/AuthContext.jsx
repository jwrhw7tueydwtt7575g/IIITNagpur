import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config.js';
import { AuthContext } from './authContextInstance.js';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('citygraph_token') || null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('citygraph_token');
      setToken(null);
      setUser(null);
      setAuthError('');
    }
  }, [token]);

  // Verify token and fetch current user profile
  useEffect(() => {
    async function verifyUser() {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          // Token is expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
      } finally {
        setAuthLoading(false);
      }
    }

    verifyUser();
  }, [token, logout]);

  const login = async (usernameOrEmail, password) => {
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username_or_email: usernameOrEmail,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed. Please check credentials.');
      }

      localStorage.setItem('citygraph_token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const register = async (email, username, password, fullName) => {
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username,
          password,
          full_name: fullName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed.');
      }

      localStorage.setItem('citygraph_token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  // Helper fetch function that automatically injects auth header and handles 401
  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      const currentToken = token || localStorage.getItem('citygraph_token');
      const headers = {
        ...options.headers,
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      };

      const res = await fetch(url, { ...options, headers });

      if (res.status === 401) {
        logout();
      }

      return res;
    },
    [token, logout]
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token && !!user,
        authLoading,
        authError,
        login,
        register,
        logout,
        fetchWithAuth,
        apiBase: API_BASE,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
