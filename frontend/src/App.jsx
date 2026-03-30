// ============================================================
// App.jsx — Root component and client-side routing
// ============================================================
// This component sets up the URL router and defines which page
// component renders for each URL path.
//
// BrowserRouter uses the HTML5 History API so URLs look like
// normal paths (/product/123) instead of hash-based (#/product/123).
//
// Route map:
//   /              → Home page (search + results)
//   /product/:id   → ProductDetail page (single product view)
//   *              → Catch-all: redirect unknown URLs back to Home

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import ProductDetail from './pages/ProductDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/register"    element={<Register />} />
          <Route path="/dashboard"   element={<Dashboard />} />
          <Route path="/profile"     element={<Profile />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="*"            element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
