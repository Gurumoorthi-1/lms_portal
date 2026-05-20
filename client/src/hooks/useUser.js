'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchUserFromDB } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

/**
 * useUser — React hook that always fetches the user from the DB.
 *
 * Returns:
 *   user    — fresh user object from DB (id, username, email, role, xp, level, streak)
 *   loading — true while fetching
 *   refetch — call this to manually refresh the user from DB
 *
 * Behaviour:
 *   - On mount: fetches /auth/me using the JWT token stored in localStorage
 *   - Redirects to /auth if no token or user found
 *   - Keeps localStorage in sync as a cache for backward compatibility
 */
export function useUser({ requireAuth = true, redirectIfNoAuth = true } = {}) {
  // To avoid hydration errors, we must start with server-safe values
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Sync from cache immediately on mount (client-side only)
    const token = localStorage.getItem('token');
    const cachedUser = localStorage.getItem('user');

    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
        setLoading(false); // We have data, we can stop loading for now
      } catch (e) {}
    }

    if (!token) {
      if (requireAuth && redirectIfNoAuth) {
        navigate('/auth');
      } else {
        setLoading(false);
      }
      return;
    }

    // 2. Background refresh/validate from DB
    fetchUserFromDB().then((freshUser) => {
      if (freshUser) {
        setUser(freshUser);
      } else if (requireAuth && redirectIfNoAuth) {
        navigate('/auth');
      }
      setLoading(false);
    });
  }, [requireAuth, redirectIfNoAuth, navigate]);

  return { user, loading, refetch: () => fetchUserFromDB().then(setUser) };
}

