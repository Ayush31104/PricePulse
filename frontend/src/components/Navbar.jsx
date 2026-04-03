// components/Navbar.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  const handleLogoClick = (event) => {
    event.preventDefault();
    window.location.href = '/';
  };

  const handleDownloadClick = (e) => {
    e.preventDefault();
    setDownloading(true);

    // If not on homepage, navigate there first then scroll
    if (window.location.pathname !== '/') {
      navigate('/');
      setTimeout(() => scrollToDownload(), 400);
    } else {
      scrollToDownload();
    }

    setTimeout(() => setDownloading(false), 1500);
  };

  const scrollToDownload = () => {
    const el = document.getElementById('download-extension');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Pulse highlight on the section after scroll lands
    setTimeout(() => {
      el.classList.add('section-highlight');
      setTimeout(() => el.classList.remove('section-highlight'), 1200);
    }, 700);
  };

  return (
    <nav className="navbar-silver sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="/" onClick={handleLogoClick} className="flex items-center gap-2 group">
            <div className="p-1 rounded-xl group-hover:scale-105 transition-all duration-200">
              <img src="/logo.png" alt="PricePulse" className="h-8 w-8 rounded-xl object-contain" />
            </div>
            <span className="text-xl font-black tracking-tight silver-text">
              Price<span className="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">Pulse</span>
            </span>
          </a>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="silver-link">Home</Link>
            <a href="/#how-it-works" className="silver-link">How It Works</a>
            <a
              href="/#download-extension"
              onClick={handleDownloadClick}
              className={`btn-gradient flex items-center gap-1.5 text-white text-xs
                         font-semibold px-4 py-1.5 rounded-xl tracking-wide
                         transition-all duration-200
                         ${downloading ? 'scale-95 opacity-80' : 'hover:scale-105'}`}
            >
              {downloading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent
                                   rounded-full animate-spin" />
                  Scrolling...
                </>
              ) : (
                <>⬇ Download Extension</>
              )}
            </a>

            {user ? (
              <>
                <Link to="/dashboard" className="silver-link flex items-center gap-1">
                  <UserCircleIcon className="h-5 w-5" />
                  {user.name?.split(' ')[0]}
                </Link>
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="silver-link">Login</Link>
                <Link to="/register"
                  className="btn-gradient text-white text-sm font-semibold px-4 py-1.5 rounded-xl">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
