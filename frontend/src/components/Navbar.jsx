import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar-wrap">
      <nav className="navbar container">
        <Link to="/" className="brand">NEXUS STORE</Link>
        <div className="nav-links">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/cart">Cart ({count})</NavLink>
          {user && <NavLink to="/dashboard">Dashboard</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </div>
        <div className="nav-auth">
          {!user && <Link className="btn ghost" to="/login">Login</Link>}
          {!user && <Link className="btn neon" to="/register">Register</Link>}
          {user && <span className="welcome">Hi, {user.name} ({user.role})</span>}
          {user && <button className="btn ghost" onClick={onLogout}>Logout</button>}
        </div>
      </nav>
    </header>
  );
}
