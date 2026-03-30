// ============================================================
// hooks/useFetch.js — Generic data-fetching hook
// ============================================================
// A reusable React hook that handles the common pattern of:
//   1. Setting loading = true
//   2. Calling an async function
//   3. Storing the result in state
//   4. Handling errors
//   5. Setting loading = false when done
//
// The `cancelled` flag prevents a state update if the component
// unmounts before the fetch completes (avoids memory leak warnings).
//
// Usage:
//   const { data, loading, error } = useFetch(() => api.get('/products/trending'));

import { useState, useEffect } from 'react';

/**
 * useFetch(fetchFn, deps)
 *
 * @param {Function} fetchFn — async function that returns an Axios response
 * @param {Array}    deps    — dependency array (re-fetches when these change)
 * @returns {{ data, loading, error }}
 */
export function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false; // becomes true if the component unmounts mid-fetch

    setLoading(true);

    fetchFn()
      .then((res) => {
        if (!cancelled) setData(res.data); // only update state if still mounted
      })
      .catch((err) => {
        // api.js response interceptor converts errors to plain Error objects,
        // so the message is always in err.message — not err.response
        if (!cancelled) setError(err.message || 'An unexpected error occurred');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Cleanup function: mark as cancelled when the component unmounts
    return () => { cancelled = true; };
  }, deps); // re-run whenever deps change (like useEffect's dependency array)

  return { data, loading, error };
}
