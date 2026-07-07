import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FaChevronUp, FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import CineverseLogo from "../../assets/png/cineverse-hd-logo-transparent.png";
import tmdbInstance from "../../service/tmdb/tmdb";
import { convertToSlug } from "../../utils/StringUtils";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;
const DEFAULT_SEARCH_RESULT_COUNT = 8;

const Navbar = () => {
  const { isLoggedIn, login, logout, user } = useAuth();
  const [navbarClass, setNavbarClass] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loginPrompt, setLoginPrompt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [isNavbarHovered, setIsNavbarHovered] = useState(false);
  const [chargedNav, setChargedNav] = useState("");
  const searchInputRef = useRef(null);
  const chargeTimeoutRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setNavbarClass(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    return () => {
      if (chargeTimeoutRef.current) {
        window.clearTimeout(chargeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleLoginRequest = (event) => {
      closeSearch();
      setLoginPrompt(event.detail || null);
      setIsLoginOpen(true);
    };

    window.addEventListener("cineverse-login-request", handleLoginRequest);

    return () => {
      window.removeEventListener("cineverse-login-request", handleLoginRequest);
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (!isSearchOpen || query.length < 2) {
      setSearchResults([]);
      setIsSearchExpanded(false);
      setIsSearching(false);
      setSearchError(false);
      return;
    }

    let isActive = true;

    const timeoutID = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);

      try {
        const response = await tmdbInstance.get(
          `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
        );

        if (!isActive) {
          return;
        }

        const results = (response.data?.results || [])
          .filter((result) => result.media_type === "movie" || result.media_type === "tv");

        setIsSearchExpanded(false);
        setSearchResults(results);
      } catch {
        if (isActive) {
          setSearchError(true);
          setSearchResults([]);
        }
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutID);
    };
  }, [isSearchOpen, searchQuery]);

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchExpanded(false);
    setSearchError(false);
  };

  const closeLogin = () => {
    setIsLoginOpen(false);
    setLoginForm({ username: "", password: "" });
    setLoginError("");
    setLoginPrompt(null);
  };

  const handleLoginSubmit = (event) => {
    event.preventDefault();

    if (!login(loginForm)) {
      setLoginError("Invalid mock credentials.");
      return;
    }

    closeLogin();
  };

  const getResultTitle = (result) => {
    return result.title || result.name || result.original_title || result.original_name;
  };

  const getResultPath = (result) => {
    const typePath = result.media_type === "tv" ? "series" : "movie";
    return `/${typePath}/${result.id}-${convertToSlug(getResultTitle(result))}`;
  };

  const getNavLinkClass = ({ isActive }) =>
    `nav-link ${isActive ? "active" : ""}`;

  const visibleSearchResults = isSearchExpanded
    ? searchResults
    : searchResults.slice(0, DEFAULT_SEARCH_RESULT_COUNT);
  const canViewMoreSearchResults = searchResults.length > DEFAULT_SEARCH_RESULT_COUNT;

  const handleNavbarMouseMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--nav-glow-x",
      `${event.clientX - bounds.left}px`
    );
    event.currentTarget.style.setProperty(
      "--nav-glow-y",
      `${event.clientY - bounds.top}px`
    );
  };

  const handleLoginMouseMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const glowX = centerX + (centerX - pointerX) * 0.32;
    const glowY = centerY + (centerY - pointerY) * 0.32;

    event.currentTarget.style.setProperty("--login-glow-x", `${glowX}px`);
    event.currentTarget.style.setProperty("--login-glow-y", `${glowY}px`);
  };

  const handleNavClick = (navKey) => {
    closeSearch();
    closeLogin();
    setChargedNav("");

    window.requestAnimationFrame(() => {
      setChargedNav(navKey);
    });

    if (chargeTimeoutRef.current) {
      window.clearTimeout(chargeTimeoutRef.current);
    }

    chargeTimeoutRef.current = window.setTimeout(() => {
      setChargedNav("");
      chargeTimeoutRef.current = null;
    }, 760);
  };

  return (
    <>
      <nav
        className={`nav ${navbarClass || isSearchOpen || isNavbarHovered ? "bg_black" : ""} ${isNavbarHovered ? "hovered" : ""}`}
        onMouseEnter={() => setIsNavbarHovered(true)}
        onMouseLeave={() => setIsNavbarHovered(false)}
        onMouseMove={handleNavbarMouseMove}
      >
        <Link to={"/"} className="logo-link" onClick={closeSearch}>
          <img className="logo" src={CineverseLogo} alt="cineverse_logo" />
        </Link>

        <div className="links">
          <NavLink to={"/"} end className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === "home" ? "charging" : ""}`} onClick={() => handleNavClick("home")}>
            <h4>Home</h4>
          </NavLink>
          <NavLink to={"/movies"} className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === "movies" ? "charging" : ""}`} onClick={() => handleNavClick("movies")}>
            <h4>Movies</h4>
          </NavLink>
          <NavLink to={"/series"} className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === "series" ? "charging" : ""}`} onClick={() => handleNavClick("series")}>
            <h4>Series</h4>
          </NavLink>
          <NavLink to={"/watchlist"} className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === "watchlist" ? "charging" : ""}`} onClick={() => handleNavClick("watchlist")}>
            <h4>Watchlist</h4>
          </NavLink>
          <NavLink to={"/blogs"} className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === "blogs" ? "charging" : ""}`} onClick={() => handleNavClick("blogs")}>
            <h4>Blogs</h4>
          </NavLink>
          <NavLink to={"/news"} className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === "news" ? "charging" : ""}`} onClick={() => handleNavClick("news")}>
            <h4>News</h4>
          </NavLink>
        </div>

        <div className="nav-actions">
          <button
            type="button"
            className={`nav-search-toggle ${isSearchOpen ? "active" : ""}`}
            aria-label={isSearchOpen ? "Close search" : "Open search"}
            onClick={() => setIsSearchOpen((currentValue) => !currentValue)}
          >
            {isSearchOpen ? <FaXmark aria-hidden="true" /> : <FaMagnifyingGlass aria-hidden="true" />}
          </button>

          <div className="nav-auth">
            {isLoggedIn ? (
              <>
                <span>{user.username}</span>
                <button type="button" onClick={logout}>Logout</button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeSearch();
                  setLoginPrompt(null);
                  setIsLoginOpen((currentValue) => !currentValue);
                }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {isLoginOpen && !isLoggedIn && (
        <div
          className="login-mockup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
          onMouseMove={handleLoginMouseMove}
        >
          <form className="login-mockup__panel" onSubmit={handleLoginSubmit}>
            <button
              type="button"
              className="login-mockup__close"
              onClick={closeLogin}
              aria-label="Close login"
            >
              <FaXmark aria-hidden="true" />
            </button>
            <p className="login-mockup__eyebrow">Members only</p>
            <h2 id="login-title">Login to watch</h2>
            <p>
              {loginPrompt?.message || "Use the mock admin profile to unlock video playback and your full watchlist dashboard."}
            </p>
            <div className="login-mockup__features">
              <strong>When logged in, you can:</strong>
              <span>Watch movies and series episodes.</span>
              <span>Add titles to your watchlist.</span>
              <span>Track progress and continue watching later.</span>
              {loginPrompt?.feature && <span>{loginPrompt.feature}</span>}
            </div>
            <label>
              Username
              <input
                type="text"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((currentValue) => ({
                    ...currentValue,
                    username: event.target.value,
                  }))
                }
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((currentValue) => ({
                    ...currentValue,
                    password: event.target.value,
                  }))
                }
                autoComplete="current-password"
              />
            </label>
            {loginError && <p className="login-mockup__error">{loginError}</p>}
            <button type="submit">Enter Cineverse</button>
          </form>
        </div>
      )}

      <div className={`search-drawer ${isSearchOpen ? "open" : ""}`}>
        <div className="search-drawer__inner">
          <label className="search-drawer__input-wrap">
            <span>Search movies and series</span>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type at least 2 characters..."
            />
          </label>

          <div className={`search-drawer__results ${isSearchExpanded ? "expanded" : ""}`}>
            {isSearching && <p>Searching...</p>}
            {searchError && <p>Search failed. Please try again.</p>}
            {!isSearching &&
              !searchError &&
              searchQuery.trim().length >= 2 &&
              !searchResults.length && <p>No results found.</p>}

            {visibleSearchResults.map((result, index) => {
              const title = getResultTitle(result);
              const imagePath = result.poster_path || result.backdrop_path;

              return (
                <Link
                  key={`${result.media_type}-${result.id}`}
                  className={`search-result ${index >= DEFAULT_SEARCH_RESULT_COUNT ? "expanded" : ""}`}
                  to={getResultPath(result)}
                  onClick={closeSearch}
                >
                  {imagePath && (
                    <img src={`${TMDB_ASSET_BASEURL}${imagePath}`} alt={title} />
                  )}
                  <div>
                    <strong>{title}</strong>
                    <span>{result.media_type === "tv" ? "Series" : "Movie"}</span>
                  </div>
                </Link>
              );
            })}

            {canViewMoreSearchResults && !isSearching && !searchError && (
              <button
                type="button"
                className="search-view-more"
                onClick={() => setIsSearchExpanded((currentValue) => !currentValue)}
              >
                {isSearchExpanded ? (
                  <>
                    Show less <FaChevronUp aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Show all <FaChevronUp className="search-view-more__down" aria-hidden="true" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
