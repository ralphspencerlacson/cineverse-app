import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { FaBars, FaChevronUp, FaHeart, FaMagnifyingGlass, FaRegHeart, FaUser, FaXmark } from "react-icons/fa6";
import CineverseLogo from "../../assets/png/cineverse-hd-logo-transparent.png";
import NoImagePlaceholder from "../../assets/png/no_image_placeholder.png";
import tmdbInstance from "../../service/tmdb/tmdb";
import { convertToSlug } from "../../utils/StringUtils";
import { useAuth } from "../../context/AuthContext";
import { CineverseLoader } from "../loading/PageSkeleton";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from "../../service/watchlist/watchlistStorage";
import "./Navbar.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;
const DEFAULT_SEARCH_RESULT_COUNT = 8;
const NAV_ITEMS = [
  { key: "home", label: "Home", to: "/", end: true },
  { key: "movies", label: "Movies", to: "/movies" },
  { key: "series", label: "Series", to: "/series" },
  { key: "watchlist", label: "Watchlist", to: "/watchlist" },
  { key: "blogs", label: "Blogs", to: "/blogs" },
  { key: "news", label: "News", to: "/news" },
];

const Navbar = () => {
  const { isLoggedIn, login, logout, user } = useAuth();
  const location = useLocation();
  const [navbarClass, setNavbarClass] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchRendered, setIsSearchRendered] = useState(false);
  const [isSearchClosing, setIsSearchClosing] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoginClosing, setIsLoginClosing] = useState(false);
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNavHovered, setIsNavHovered] = useState(false);
  const [isNavPinned, setIsNavPinned] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isTrailerProjectionOpen, setIsTrailerProjectionOpen] = useState(false);
  const [chargedNav, setChargedNav] = useState("");
  const [watchlistIDs, setWatchlistIDs] = useState(() => new Set());
  const searchInputRef = useRef(null);
  const searchToggleRef = useRef(null);
  const mobileMenuToggleRef = useRef(null);
  const mobileMenuPanelRef = useRef(null);
  const accountRef = useRef(null);
  const navRef = useRef(null);
  const searchDrawerRef = useRef(null);
  const searchCloseTimeoutRef = useRef(null);
  const searchExitTimeoutRef = useRef(null);
  const searchPointerTargetsRef = useRef(new Set());
  const chargeTimeoutRef = useRef(null);
  const loginExitTimeoutRef = useRef(null);
  const loginSuccessTimeoutRef = useRef(null);
  const loginStateRef = useRef({ isOpen: false, isClosing: false });
  const navCollapseTimeoutRef = useRef(null);
  loginStateRef.current = { isOpen: isLoginOpen, isClosing: isLoginClosing };

  const closeSearch = useCallback(() => {
    if (searchCloseTimeoutRef.current) {
      window.clearTimeout(searchCloseTimeoutRef.current);
      searchCloseTimeoutRef.current = null;
    }

    if (searchExitTimeoutRef.current) {
      window.clearTimeout(searchExitTimeoutRef.current);
    }

    setIsSearchOpen(false);
    setIsSearchClosing(true);
    searchExitTimeoutRef.current = window.setTimeout(() => {
      setIsSearchRendered(false);
      setIsSearchClosing(false);
      setSearchQuery("");
      setSearchResults([]);
      setIsSearchExpanded(false);
      setSearchError(false);
      searchExitTimeoutRef.current = null;
    }, 220);
  }, []);

  const openSearch = () => {
    if (searchExitTimeoutRef.current) {
      window.clearTimeout(searchExitTimeoutRef.current);
      searchExitTimeoutRef.current = null;
    }

    setIsSearchRendered(true);
    setIsSearchClosing(false);
    setIsSearchOpen(true);
  };

  const isInSearchSurface = useCallback((target) => {
    return Boolean(
      target &&
      (searchToggleRef.current?.contains(target) || searchDrawerRef.current?.contains(target))
    );
  }, []);

  const cancelDelayedSearchClose = () => {
    if (searchCloseTimeoutRef.current) {
      window.clearTimeout(searchCloseTimeoutRef.current);
      searchCloseTimeoutRef.current = null;
    }
  };

  const scheduleSearchClose = () => {
    cancelDelayedSearchClose();
    searchCloseTimeoutRef.current = window.setTimeout(() => {
      const hasFocus = isInSearchSurface(document.activeElement);
      const hasPointer = searchPointerTargetsRef.current.size > 0;

      if (!hasFocus && !hasPointer) {
        closeSearch();
      }
    }, 180);
  };

  const cancelNavCollapse = () => {
    if (navCollapseTimeoutRef.current) {
      window.clearTimeout(navCollapseTimeoutRef.current);
      navCollapseTimeoutRef.current = null;
    }
  };

  const scheduleNavCollapse = () => {
    cancelNavCollapse();
    navCollapseTimeoutRef.current = window.setTimeout(() => {
      setIsNavHovered(false);
      navCollapseTimeoutRef.current = null;
    }, 3000);
  };

  const handleSearchPointerEnter = (event) => {
    searchPointerTargetsRef.current.add(event.currentTarget);
    cancelDelayedSearchClose();
  };

  const handleSearchPointerLeave = (event) => {
    searchPointerTargetsRef.current.delete(event.currentTarget);
    scheduleSearchClose();
  };

  useEffect(() => {
    const handleScroll = () => {
      setNavbarClass(window.scrollY > 100);
    };

    handleScroll();
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
    closeSearch();
    setIsMobileMenuOpen(false);
    setIsAccountOpen(false);
  }, [closeSearch, location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!isNavPinned) {
      return undefined;
    }

    const handlePinnedNavDismiss = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") {
        return;
      }

      if (event.type === "pointerdown" && navRef.current?.contains(event.target)) {
        return;
      }

      setIsNavPinned(false);
      setIsNavHovered(false);
    };

    document.addEventListener("pointerdown", handlePinnedNavDismiss);
    document.addEventListener("keydown", handlePinnedNavDismiss);

    return () => {
      document.removeEventListener("pointerdown", handlePinnedNavDismiss);
      document.removeEventListener("keydown", handlePinnedNavDismiss);
    };
  }, [isNavPinned]);

  useEffect(() => {
    if (!isAccountOpen) {
      return undefined;
    }

    const handleAccountDismiss = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") {
        return;
      }

      if (event.type === "pointerdown" && accountRef.current?.contains(event.target)) {
        return;
      }

      setIsAccountOpen(false);
    };

    document.addEventListener("pointerdown", handleAccountDismiss);
    document.addEventListener("keydown", handleAccountDismiss);

    return () => {
      document.removeEventListener("pointerdown", handleAccountDismiss);
      document.removeEventListener("keydown", handleAccountDismiss);
    };
  }, [isAccountOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;
    const menuToggle = mobileMenuToggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      mobileMenuPanelRef.current?.querySelector("a, button")?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = mobileMenuPanelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      } else {
        menuToggle?.focus();
      }
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return undefined;
    }

    const handleOutsideInteraction = (event) => {
      if (!isInSearchSurface(event.target)) {
        closeSearch();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeSearch();
        searchToggleRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handleOutsideInteraction);
    document.addEventListener("click", handleOutsideInteraction);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideInteraction);
      document.removeEventListener("click", handleOutsideInteraction);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeSearch, isInSearchSurface, isSearchOpen]);

  useEffect(() => {
    return () => {
      if (chargeTimeoutRef.current) {
        window.clearTimeout(chargeTimeoutRef.current);
      }
      if (searchCloseTimeoutRef.current) {
        window.clearTimeout(searchCloseTimeoutRef.current);
      }
      if (searchExitTimeoutRef.current) {
        window.clearTimeout(searchExitTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const refreshWatchlist = () => {
      setWatchlistIDs(
        new Set(isLoggedIn ? getWatchlist().map((item) => item.id) : [])
      );
    };

    refreshWatchlist();
    window.addEventListener("cineverse-watchlist-change", refreshWatchlist);
    window.addEventListener("cineverse-watchlist-sync", refreshWatchlist);
    window.addEventListener("storage", refreshWatchlist);

    return () => {
      window.removeEventListener("cineverse-watchlist-change", refreshWatchlist);
      window.removeEventListener("cineverse-watchlist-sync", refreshWatchlist);
      window.removeEventListener("storage", refreshWatchlist);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const handleLoginRequest = (event) => {
      closeSearch();
      window.clearTimeout(loginExitTimeoutRef.current);
      window.clearTimeout(loginSuccessTimeoutRef.current);
      window.clearTimeout(navCollapseTimeoutRef.current);
      setLoginPrompt(event.detail || null);
      setIsLoginClosing(false);
      setIsLoginSuccess(false);
      setIsLoginOpen(true);
    };

    window.addEventListener("cineverse-login-request", handleLoginRequest);

    return () => {
      window.removeEventListener("cineverse-login-request", handleLoginRequest);
    };
  }, [closeSearch]);

  useEffect(() => {
    const handlePlayerState = (event) => {
      const nextIsPlayerOpen = Boolean(event.detail?.isOpen);
      setIsPlayerOpen(nextIsPlayerOpen);

      if (nextIsPlayerOpen) {
        closeSearch();
        closeLogin();
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("cineverse-player-state", handlePlayerState);

    return () => {
      window.removeEventListener("cineverse-player-state", handlePlayerState);
    };
  }, [closeSearch]);

  useEffect(() => {
    const handleTrailerState = (event) => {
      setIsTrailerProjectionOpen(Boolean(event.detail?.isOpen));
    };

    window.addEventListener("cineverse-trailer-state", handleTrailerState);
    return () => window.removeEventListener("cineverse-trailer-state", handleTrailerState);
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

  const openLogin = () => {
    closeSearch();
    setIsMobileMenuOpen(false);
    if (isLoginOpen) {
      closeLogin();
      return;
    }

    window.clearTimeout(loginExitTimeoutRef.current);
    window.clearTimeout(loginSuccessTimeoutRef.current);
    setLoginPrompt(null);
    setIsLoginClosing(false);
    setIsLoginSuccess(false);
    setIsLoginOpen(true);
  };

  const closeLogin = () => {
    if (!loginStateRef.current.isOpen || loginStateRef.current.isClosing) {
      return;
    }

    window.clearTimeout(loginSuccessTimeoutRef.current);
    setIsLoginClosing(true);
    loginExitTimeoutRef.current = window.setTimeout(() => {
      setIsLoginOpen(false);
      setIsLoginClosing(false);
      setIsLoginSuccess(false);
      setLoginForm({ username: "", password: "" });
      setLoginError("");
      setLoginPrompt(null);
      loginExitTimeoutRef.current = null;
    }, 820);
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    const result = await login(loginForm);
    setIsLoggingIn(false);

    if (!result.success) {
      setLoginError(result.error || "Login failed. Please try again.");
      return;
    }

    setIsLoginSuccess(true);
    loginSuccessTimeoutRef.current = window.setTimeout(closeLogin, 1800);
  };

  useEffect(() => {
    if (!isLoginOpen) {
      return undefined;
    }

    const handleLoginKeyDown = (event) => {
      if (event.key === "Escape") {
        closeLogin();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleLoginKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleLoginKeyDown);
    };
  }, [isLoginClosing, isLoginOpen]);

  useEffect(() => {
    return () => {
      window.clearTimeout(loginExitTimeoutRef.current);
      window.clearTimeout(loginSuccessTimeoutRef.current);
      window.clearTimeout(navCollapseTimeoutRef.current);
    };
  }, []);

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

  const handleSearchWatchlistClick = (event, result) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isLoggedIn) {
      window.dispatchEvent(
        new CustomEvent("cineverse-login-request", {
          detail: {
            message: "Login to add this title to your watchlist.",
            feature: "Watchlist access keeps your saved movies, series, progress, and continue-watching links together.",
          },
        })
      );
      return;
    }

    const watchlistID = `${result.media_type}:${result.id}`;
    if (watchlistIDs.has(watchlistID)) {
      removeFromWatchlist(watchlistID);
      setWatchlistIDs((currentIDs) => {
        const nextIDs = new Set(currentIDs);
        nextIDs.delete(watchlistID);
        return nextIDs;
      });
      return;
    }

    addToWatchlist({
      id: watchlistID,
      tmdbID: result.id,
      type: result.media_type,
      title: getResultTitle(result),
      posterPath: result.poster_path || null,
      backdropPath: result.backdrop_path || null,
      releaseDate: result.first_air_date || result.release_date || null,
      tmdbStatus: null,
      totalSeasons: null,
      totalEpisodes: null,
      nextEpisodeDate: null,
      detailPath: getResultPath(result),
    });
    setWatchlistIDs((currentIDs) => new Set(currentIDs).add(watchlistID));
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
    setIsMobileMenuOpen(false);
    setChargedNav("");

    if (window.matchMedia("(min-width: 1025px)").matches) {
      setIsNavHovered(true);
    }

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

  if (isPlayerOpen) {
    return null;
  }

  const isProjectionActive = isLoginOpen || isTrailerProjectionOpen;
  const isNavExpanded = !isProjectionActive && Boolean(
    navbarClass ||
    isNavHovered ||
    isNavPinned ||
    isSearchOpen ||
    isSearchRendered ||
    isMobileMenuOpen ||
    isAccountOpen
  );

  return (
    <>
      <nav
        ref={navRef}
        className={`nav ${isNavExpanded ? "expanded bg_black" : "collapsed"} ${isProjectionActive ? "projection-active" : ""}`}
        onPointerEnter={cancelNavCollapse}
        onPointerLeave={() => {
          if (!isNavPinned && !isSearchRendered && !isAccountOpen && !isMobileMenuOpen) {
            scheduleNavCollapse();
          }
        }}
        onFocus={() => {
          cancelNavCollapse();
          setIsNavHovered(true);
        }}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget) &&
            !isNavPinned &&
            !isSearchRendered &&
            !isAccountOpen &&
            !isMobileMenuOpen
          ) {
            setIsNavHovered(false);
          }
        }}
      >
        <button
          type="button"
          className="nav-reveal"
          aria-label={isNavPinned ? "Allow navigation to collapse" : isNavExpanded ? "Keep navigation open" : "Open navigation"}
          aria-expanded={isNavExpanded}
          onPointerEnter={() => setIsNavHovered(true)}
          onClick={() => {
            if (window.matchMedia("(max-width: 1024px)").matches) {
              setIsMobileMenuOpen(true);
              return;
            }

            setIsNavHovered(true);
            setIsNavPinned((currentValue) => !currentValue);
          }}
        >
          <img src={CineverseLogo} alt="" />
        </button>

        <div className="nav__inner">
          <span className="logo-link" aria-hidden="true" />

          <div className="links">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === item.key ? "charging" : ""}`}
                onClick={() => handleNavClick(item.key)}
              >
                <h4>{item.label}</h4>
                {item.key === "watchlist" && watchlistIDs.size > 0 && (
                  <span
                    key={watchlistIDs.size}
                    className="nav-link__count"
                    data-count={watchlistIDs.size}
                    aria-label={`${watchlistIDs.size} saved titles`}
                  >
                    {watchlistIDs.size}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="nav-actions">
            <button
              ref={mobileMenuToggleRef}
              type="button"
              className={`nav-menu-toggle ${isMobileMenuOpen ? "active" : ""}`}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => {
                closeSearch();
                setIsMobileMenuOpen((currentValue) => !currentValue);
              }}
            >
              {isMobileMenuOpen ? <FaXmark aria-hidden="true" /> : <FaBars aria-hidden="true" />}
            </button>

            <button
              ref={searchToggleRef}
              type="button"
              className={`nav-search-toggle ${isSearchOpen ? "active" : ""}`}
              aria-label={isSearchOpen ? "Close search" : "Open search"}
              aria-expanded={isSearchOpen}
              aria-controls="site-search"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsAccountOpen(false);
                if (isSearchOpen) {
                  closeSearch();
                } else {
                  openSearch();
                }
              }}
              onPointerEnter={handleSearchPointerEnter}
              onPointerLeave={handleSearchPointerLeave}
              onFocus={cancelDelayedSearchClose}
              onBlur={scheduleSearchClose}
            >
              {isSearchOpen ? <FaXmark aria-hidden="true" /> : <FaMagnifyingGlass aria-hidden="true" />}
            </button>

            <div className="nav-auth" ref={accountRef}>
              {isLoggedIn ? (
                <>
                  <button
                    type="button"
                    className={`nav-account__trigger ${isAccountOpen ? "active" : ""}`}
                    aria-label="Open user account"
                    aria-expanded={isAccountOpen}
                    aria-controls="nav-account-popover"
                    onClick={() => {
                      closeSearch();
                      setIsAccountOpen((currentValue) => !currentValue);
                    }}
                  >
                    <FaUser aria-hidden="true" />
                    <span>User</span>
                  </button>

                  {isAccountOpen && (
                    <div
                      className="nav-account__popover"
                      id="nav-account-popover"
                      role="dialog"
                      aria-label="User account"
                    >
                      <span className="nav-account__eyebrow">Account</span>
                      <strong>{user.username}</strong>
                      {user.email && user.email !== user.username && (
                        <span className="nav-account__email">{user.email}</span>
                      )}
                      <button
                        type="button"
                        className="nav-account__logout"
                        onClick={() => {
                          setIsAccountOpen(false);
                          logout();
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button type="button" className="nav-auth__login" onClick={openLogin}>Login</button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div className="nav-drawer open" id="mobile-navigation">
          <div
            ref={mobileMenuPanelRef}
            className="nav-drawer__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div className="nav-drawer__links">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `${getNavLinkClass({ isActive })} ${chargedNav === item.key ? "charging" : ""}`}
                  onClick={() => handleNavClick(item.key)}
                >
                  <span>{item.label}</span>
                  {item.key === "watchlist" && watchlistIDs.size > 0 && (
                    <span
                      key={watchlistIDs.size}
                      className="nav-link__count"
                      data-count={watchlistIDs.size}
                      aria-label={`${watchlistIDs.size} saved titles`}
                    >
                      {watchlistIDs.size}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="nav-drawer__account">
              <span>Account</span>
              {isLoggedIn ? (
                <>
                  <strong>{user.username}</strong>
                  <button type="button" onClick={() => { setIsMobileMenuOpen(false); logout(); }}>Logout</button>
                </>
              ) : (
                <button type="button" onClick={openLogin}>Login</button>
              )}
            </div>
          </div>
          <button
            type="button"
            className="nav-drawer__backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </div>
      )}

      {isLoginOpen && (
        <div
          className={`login-mockup ${isLoginClosing ? "is-closing" : isLoginSuccess ? "is-success" : "is-opening"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
          onMouseMove={handleLoginMouseMove}
          onClick={closeLogin}
        >
          <div className="login-mockup__spotlight" aria-hidden="true">
            <i />
          </div>
          <form
            className="login-mockup__panel"
            onSubmit={handleLoginSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="login-mockup__close"
              onClick={closeLogin}
              aria-label="Close login"
            >
              <FaXmark aria-hidden="true" />
            </button>
            {isLoginSuccess ? (
              <div className="login-mockup__success" role="status" aria-live="polite">
                <span className="login-mockup__success-mark" aria-hidden="true"><i /></span>
                <p className="login-mockup__eyebrow">Access granted</p>
                <h2 id="login-title">Welcome to Cineverse</h2>
                <p>Login successful. Your watchlist and viewing progress are ready.</p>
              </div>
            ) : (
              <>
                <div className="login-mockup__briefing">
                  <p className="login-mockup__eyebrow">Members screening room</p>
                  <h2 id="login-title">Your next scene is waiting.</h2>
                  <p className="login-mockup__deck">One account keeps every story, save, and unfinished episode in frame.</p>

                  <CineverseLoader className="login-mockup__signal" label="Signal ready" />

                  <div className="login-mockup__features">
                    <span><i>01</i> Watch without interruption</span>
                    <span><i>02</i> Build your private watchlist</span>
                    <span><i>03</i> Continue from the last frame</span>
                    {loginPrompt?.feature && <span><i>04</i> {loginPrompt.feature}</span>}
                  </div>
                </div>

                <div className="login-mockup__credentials">
                  <p className="login-mockup__eyebrow">Secure entry / 01</p>
                  <h3>Member access</h3>
                  <p>{loginPrompt?.message || "Sign in to unlock playback and your personal Cineverse dashboard."}</p>
                  <label>
                    <span>Email address</span>
                    <input
                      type="email"
                      value={loginForm.username}
                      onChange={(event) =>
                        setLoginForm((currentValue) => ({
                          ...currentValue,
                          username: event.target.value,
                        }))
                      }
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    <span>Password</span>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((currentValue) => ({
                          ...currentValue,
                          password: event.target.value,
                        }))
                      }
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                  </label>
                  {loginError && <p className="login-mockup__error">{loginError}</p>}
                  <button type="submit" disabled={isLoggingIn}>
                    <span>{isLoggingIn ? "Opening the room..." : "Enter Cineverse"}</span>
                    <i aria-hidden="true">&#8594;</i>
                  </button>
                  <small className="login-mockup__privacy">Encrypted access / Your viewing data stays private</small>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {isSearchRendered && (
        <div
          id="site-search"
          ref={searchDrawerRef}
          className={`search-drawer ${isSearchClosing ? "closing" : "open"}`}
          onPointerEnter={handleSearchPointerEnter}
          onPointerLeave={handleSearchPointerLeave}
          onFocusCapture={cancelDelayedSearchClose}
          onBlurCapture={scheduleSearchClose}
        >
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
                const watchlistID = `${result.media_type}:${result.id}`;
                const isSavedToWatchlist = watchlistIDs.has(watchlistID);

                return (
                  <article
                    key={`${result.media_type}-${result.id}`}
                    className={`search-result ${index >= DEFAULT_SEARCH_RESULT_COUNT ? "expanded" : ""}`}
                  >
                    <Link
                      className="search-result__details"
                      to={getResultPath(result)}
                      onClick={closeSearch}
                      aria-label={`Open ${title} details`}
                    >
                      <img
                        src={imagePath ? `${TMDB_ASSET_BASEURL}${imagePath}` : NoImagePlaceholder}
                        alt=""
                        onError={(event) => {
                          if (event.currentTarget.dataset.fallbackApplied) return;
                          event.currentTarget.dataset.fallbackApplied = "true";
                          event.currentTarget.src = NoImagePlaceholder;
                        }}
                      />
                      <div>
                        <strong>{title}</strong>
                        <span>{result.media_type === "tv" ? "Series" : "Movie"}</span>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className={`search-result__watchlist ${isSavedToWatchlist ? "saved" : ""}`}
                      onClick={(event) => handleSearchWatchlistClick(event, result)}
                      aria-label={isSavedToWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
                      title={isSavedToWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      {isSavedToWatchlist ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
                    </button>
                  </article>
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
      )}
    </>
  );
};

export default Navbar;
