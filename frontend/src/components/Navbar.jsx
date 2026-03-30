// components/Navbar.jsx
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCartIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogoClick = (event) => {
    event.preventDefault();
    window.location.href = '/';
  };

  return (
    <nav className="navbar-silver sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="/" onClick={handleLogoClick} className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-violet-500 to-blue-600 p-2 rounded-xl shadow-md
                            group-hover:shadow-violet-400/40 group-hover:scale-105 transition-all duration-200">
              <ShoppingCartIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight silver-text">
              Price<span className="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">Pulse</span>
            </span>
          </a>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="silver-link">Home</Link>
            <a href="#how-it-works" className="silver-link">How It Works</a>
            <span className="text-xs font-semibold px-3 py-1 rounded-full
                             bg-white/20 border border-white/30 text-slate-300 tracking-wide">
              Free to Use
            </span>

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
