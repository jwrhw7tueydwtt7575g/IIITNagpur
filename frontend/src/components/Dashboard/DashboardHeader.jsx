import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './DashboardHeader.css';

export default function DashboardHeader({
  connectionStatus,
  onRetryConnection,
  onSearchSelect,
  nodes = [],
  user = null,
  onLogout,
  selectedLocation,
  setSelectedLocation,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [timeString, setTimeString] = useState('');
  const searchInputRef = useRef(null);
  const profileRef = useRef(null);

  // Live formatted clock matching reference screenshot
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timePart = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      setTimeString(`${datePart} ${timePart}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Ctrl+K / Cmd+K listener and click outside to close menus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
        searchInputRef.current?.blur();
      }
    };
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Derived search filter across ID, name, short_name, type, zone, cluster (no setState in effect)
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return nodes.filter(
      (n) =>
        (n.name && n.name.toLowerCase().includes(q)) ||
        (n.short_name && n.short_name.toLowerCase().includes(q)) ||
        (n.id && n.id.toLowerCase().includes(q)) ||
        (n.type && n.type.toLowerCase().includes(q)) ||
        (n.type_label && n.type_label.toLowerCase().includes(q)) ||
        (n.zone && n.zone.toLowerCase().includes(q)) ||
        (n.description && n.description.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [searchTerm, nodes]);

  const handleSelectAsset = (asset) => {
    setSearchTerm('');
    setSearchOpen(false);
    if (onSearchSelect) onSearchSelect(asset);
  };

  return (
    <header className="dash-header" role="banner">
      {/* Left: Location Selector */}
      <div className="dash-header-left">
        <div className="location-select-wrap">
          <span className="location-pin-icon" aria-hidden="true">📍</span>
          <select
            className="location-dropdown"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            aria-label="Location Selector"
          >
            <option value="delhi_ncr">New Delhi, India</option>
            <option value="central_delhi">Central Delhi (Connaught Place / ITO)</option>
            <option value="south_delhi">South Delhi (AIIMS / Okhla)</option>
            <option value="north_delhi">North Delhi (Wazirabad / Kashmere Gate)</option>
            <option value="trans_yamuna">East Delhi / Trans-Yamuna</option>
            <option value="noida">Noida / Greater Noida Corridor</option>
            <option value="gurugram">Gurugram Cyber Corridor</option>
            <option value="ghaziabad">Ghaziabad / GT Road Axis</option>
            <option value="faridabad">Faridabad Industrial Axis</option>
          </select>
          <span className="dropdown-caret" aria-hidden="true">▾</span>
        </div>
      </div>

      {/* Center: Search Box with live dropdown & Ctrl K badge */}
      <div className="dash-header-center">
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search location, asset, or node ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => { if (searchResults.length) setSearchOpen(true); }}
            aria-label="Search Assets"
          />
          <div className="search-ctrl-badge" title="Press Ctrl+K to search">Ctrl K</div>
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => { setSearchTerm(''); setSearchOpen(false); }}
            >
              ✕
            </button>
          )}

          {/* Search suggestions dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="search-results-dropdown">
              <div className="dropdown-search-header">
                <span>Matching Infrastructure Assets ({searchResults.length})</span>
                <span className="dropdown-esc-hint">ESC to close</span>
              </div>
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="search-result-row"
                  onClick={() => handleSelectAsset(item)}
                >
                  <div className="result-text">
                    <span className="result-name">{item.name || item.id}</span>
                    <span className="result-sub">{item.type_label || item.type} &bull; {item.zone || 'Delhi-NCR'}</span>
                  </div>
                  <span className={`result-status-pill status-${item.status || 'safe'}`}>
                    {item.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Connection status, Weather, Clock, Notifications & User */}
      <div className="dash-header-right">
        {/* Connection Status Badge */}
        <div className="connection-status-container">
          <div className={`status-pill-badge ${connectionStatus === 'connected' ? 'connected' : 'disconnected'}`}>
            <span className="status-circle"></span>
            <span>{connectionStatus === 'connected' ? 'Backend Connected' : 'Backend Disconnected'}</span>
          </div>

          {connectionStatus === 'disconnected' && onRetryConnection && (
            <button
              type="button"
              className="header-retry-btn"
              onClick={onRetryConnection}
              title="Retry connecting to server"
            >
              ⟲
            </button>
          )}
        </div>

        {/* Weather Indicator */}
        <div className="header-weather" title="Monsoon Telemetry: Delhi Meteorological Station">
          <span className="weather-icon" aria-hidden="true">🌧</span>
          <div className="weather-text">
            <span className="weather-temp">28°C</span>
            <span className="weather-desc">Light Rain</span>
          </div>
        </div>

        {/* Live Clock */}
        <div className="header-clock" title="System Operations Clock">
          <span className="clock-text">{timeString || 'Sep 20, 2026 5:58 PM'}</span>
        </div>

        {/* Notifications Icon with Unread Badge */}
        <button
          type="button"
          className="header-notification-btn"
          aria-label="View notifications"
          title="4 active system advisories"
        >
          <span className="bell-icon" aria-hidden="true">🔔</span>
          <span className="notification-badge">4</span>
        </button>

        {/* User Profile or Public Demo */}
        {user ? (
          <div className="header-profile-menu-container" ref={profileRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="user-btn"
              onClick={() => setProfileOpen(!profileOpen)}
              title={`Logged in as ${user.username || user.email}`}
              aria-expanded={profileOpen}
            >
              <div className="user-avatar-circle">
                {(user.username || user.email || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="user-text-col">
                <span className="user-name-text">{user.username || 'Commander'}</span>
                <span className="user-role-text">{user.role || 'Incident Commander'}</span>
              </div>
              <span className="dropdown-caret" aria-hidden="true">▾</span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown-menu">
                <div className="profile-dropdown-info">
                  <strong>{user.full_name || user.username}</strong>
                  <span>{user.email}</span>
                  <span className="profile-role-tag">{user.role || 'Incident Commander'}</span>
                </div>
                <div className="profile-divider" />
                {onLogout && (
                  <button
                    type="button"
                    className="profile-logout-btn"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                  >
                    🚪 Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="header-demo-auth-group">
            <span className="demo-pill-badge">◉ Public Demo</span>
            <Link to="/login" className="header-signin-btn">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
