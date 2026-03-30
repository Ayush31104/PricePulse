import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService, historyService } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [clearing, setClearing] = useState(false);

  const { data: profileRes, loading, error } = useFetch(userService.getProfile);
  const { data: historyRes, loading: histLoading, error: histError } =
    useFetch(historyService.getHistory);

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) return <p className="text-center mt-16 text-gray-500">Loading profile...</p>;
  if (error)   return <p className="text-center mt-16 text-red-500">{error}</p>;

  const profile = profileRes?.data ?? profileRes;
  const history = historyRes?.data ?? [];

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await historyService.clearHistory();
      // force re-fetch by navigating away and back, or just reload
      window.location.reload();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-16 px-4 space-y-6">
      {/* Profile card */}
      <div className="bg-white p-8 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Your Profile</h2>
        <div className="space-y-3 text-gray-700">
          <p><span className="font-semibold">Name:</span> {profile?.name}</p>
          <p><span className="font-semibold">Email:</span> {profile?.email}</p>
          <p><span className="font-semibold">Member since:</span> {new Date(profile?.createdAt).toLocaleDateString()}</p>
        </div>
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="mt-6 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* Search history */}
      <div className="bg-white p-8 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Your Search History</h3>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              {clearing ? 'Clearing...' : 'Clear History'}
            </button>
          )}
        </div>

        {histLoading && <p className="text-gray-400 text-sm">Loading history...</p>}
        {histError  && <p className="text-red-400 text-sm">{histError}</p>}

        {!histLoading && history.length === 0 && (
          <p className="text-gray-400 text-sm">No searches yet. Start comparing prices!</p>
        )}

        <ul className="divide-y divide-gray-100">
          {history.map((item) => (
            <li key={item._id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 capitalize">{item.query}</p>
                <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right text-sm">
                {item.cheapestPrice && (
                  <p className="text-green-600 font-semibold">
                    ₹{item.cheapestPrice.toLocaleString()}
                    {item.cheapestPlatform && <span className="text-gray-400 font-normal"> on {item.cheapestPlatform}</span>}
                  </p>
                )}
                {item.resultsCount > 0 && (
                  <p className="text-xs text-gray-400">{item.resultsCount} results</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
