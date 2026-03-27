// components/Navbar.jsx
import { Link } from "react-router-dom";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";

export default function Navbar() {
  const handleLogoClick = (event) => {
    event.preventDefault();
    window.location.href = "/";
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a
            href="/"
            onClick={handleLogoClick}
            className="flex items-center gap-2 group"
          >
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl shadow group-hover:shadow-md transition-shadow">
              <ShoppingCartIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">
              Price<span className="text-blue-600">Pulse</span>
            </span>
          </a>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How It Works</a>
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold border border-blue-100">
              Free to Use
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
