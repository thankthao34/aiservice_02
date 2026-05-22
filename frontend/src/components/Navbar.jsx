import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { productService } from '../services/productService';
import { formatPriceVndFromUsd } from '../utils/currency';

const SEARCH_HISTORY_KEY = 'nexus_search_history';
const MAX_SEARCH_HISTORY = 5;

function readSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SEARCH_HISTORY) : [];
  } catch {
    return [];
  }
}

function getSuggestionGroups(searchValue, searchHistory) {
  const typed = String(searchValue || '').trim();
  if (typed) {
    return [{ term: typed, limit: 10 }];
  }

  const seeds = Array.isArray(searchHistory)
    ? searchHistory.map((item) => String(item || '').trim()).filter(Boolean).slice(0, MAX_SEARCH_HISTORY)
    : [];
  if (seeds.length) {
    return seeds.map((term) => ({ term, limit: 2 }));
  }

  try {
    const last = String(localStorage.getItem('nexus_last_search_query') || '').trim();
    return last ? [{ term: last, limit: 10 }] : [];
  } catch {
    return [];
  }
}

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);

  useEffect(() => {
    setSearchHistory(readSearchHistory());
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const onPointerDown = (event) => {
      if (!event.target.closest('.nav-search')) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const groups = getSuggestionGroups(searchValue, searchHistory);
        const response = groups.length
          ? await Promise.all(groups.map(async ({ term, limit }) => {
            const res = await productService.list({ search: term }).catch(() => ({ data: [] }));
            return {
              term,
              products: (res.data || []).slice(0, limit)
            };
          }))
          : [{ term: 'featured', products: await productService.featured().then((res) => (res.data || []).slice(0, 10)).catch(() => []) }];
        if (!cancelled) {
          setSearchSuggestions(response);
        }
      } catch {
        if (!cancelled) setSearchSuggestions([]);
      }
    }, searchValue.trim().length >= 2 ? 180 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchValue, searchHistory]);

  const submitSearch = (rawTerm) => {
    const term = String(rawTerm || '').trim();
    if (term.length < 2) return;

    localStorage.setItem('nexus_last_search_query', term);
    setSearchHistory((prev) => {
      const next = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });

    window.dispatchEvent(new CustomEvent('nexus-search-submit', { detail: term }));
    setSearchValue(term);
    setSearchOpen(false);
    navigate('/');
  };

  const removeHistoryItem = (term) => {
    const next = searchHistory.filter((item) => item !== term);
    setSearchHistory(next);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  };

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar-wrap">
      <nav className="navbar container">
        <Link to="/" className="brand">Omni Store</Link>
        <div className="nav-center">
          <div className="nav-links">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/cart" className="nav-cart-link">Cart ({count})</NavLink>
            {user && <NavLink to="/dashboard">Dashboard</NavLink>}
            {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          </div>
          <div className="nav-search">
            <form className="nav-search-bar card" role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(searchValue); }}>
              <span className="nav-search-icon" aria-hidden="true">⌕</span>
              <input
                type="text"
                value={searchValue}
                onFocus={() => {
                  setSearchOpen(true);
                  setSearchHistory(readSearchHistory());
                }}
                onClick={() => {
                  setSearchOpen(true);
                  setSearchHistory(readSearchHistory());
                }}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitSearch(e.currentTarget.value);
                  }
                }}
                placeholder="Tìm sản phẩm, ví dụ: tai nghe, áo khoác..."
              />
            </form>
            {searchOpen && (
              <div className="nav-search-dropdown card">
                {!!searchHistory.length ? (
                  <>
                    <small>Lịch sử tìm kiếm</small>
                    <div className="nav-search-history-list">
                      {searchHistory.map((term) => (
                        <div className="nav-search-history-item" key={term}>
                          <button
                            type="button"
                            className="nav-search-history-restore"
                            onClick={() => {
                              setSearchValue(term);
                              submitSearch(term);
                            }}
                          >
                            <span className="nav-search-history-icon" aria-hidden="true">🕘</span>
                            <span className="nav-search-history-text">{term}</span>
                          </button>
                          <button
                            type="button"
                            className="nav-search-history-remove"
                            aria-label={`Xoá ${term}`}
                            onClick={() => removeHistoryItem(term)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <small>Chưa có lịch sử tìm kiếm</small>
                )}

                {!!searchSuggestions.length ? (
                  <div className="nav-search-suggestion-group-list">
                    {searchSuggestions.map((group) => (
                      <div className="nav-search-suggestion-group" key={group.term}>
                        <div className="nav-search-suggestion-list">
                          {group.products.map((product) => (
                            <Link
                              to={`/product/${product.id}`}
                              key={`${group.term}-${product.id}`}
                              className="nav-search-suggestion-item"
                              onClick={() => setSearchOpen(false)}
                            >
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="nav-search-suggestion-thumb"
                              />
                              <div className="nav-search-suggestion-meta">
                                <strong>{product.name}</strong>
                                <span>{formatPriceVndFromUsd(product.price)}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <small>Chưa có sản phẩm phù hợp</small>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="nav-auth nav-user">
          {!user && <Link className="btn ghost" to="/login">Login</Link>}
          {!user && <Link className="btn neon" to="/register">Register</Link>}
          {user && <span className="welcome">Hi, {user.name} ({user.role})</span>}
          {user && <button className="btn ghost nav-logout" onClick={onLogout}>Logout</button>}
          </div>
      </nav>
    </header>
  );
}
