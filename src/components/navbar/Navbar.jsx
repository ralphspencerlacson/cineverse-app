import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import CineverseLogo from "../../assets/png/cineverse-hd-logo-transparent.png";
import tmdbInstance from "../../service/tmdb/tmdb";
import { convertToSlug } from "../../utils/StringUtils";
import "./Navbar.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const Navbar = () => {
  const [navbarClass, setNavbarClass] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
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
    const query = searchQuery.trim();

    if (!isSearchOpen || query.length < 2) {
      setSearchResults([]);
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
          .filter((result) => result.media_type === "movie" || result.media_type === "tv")
          .slice(0, 8);

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
    setSearchError(false);
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

  const handleNavClick = (navKey) => {
    closeSearch();
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

        <button
          type="button"
          className={`nav-search-toggle ${isSearchOpen ? "active" : ""}`}
          aria-label={isSearchOpen ? "Close search" : "Open search"}
          onClick={() => setIsSearchOpen((currentValue) => !currentValue)}
        >
          <span></span>
        </button>
      </nav>

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

          <div className="search-drawer__results">
            {isSearching && <p>Searching...</p>}
            {searchError && <p>Search failed. Please try again.</p>}
            {!isSearching &&
              !searchError &&
              searchQuery.trim().length >= 2 &&
              !searchResults.length && <p>No results found.</p>}

            {searchResults.map((result) => {
              const title = getResultTitle(result);
              const imagePath = result.poster_path || result.backdrop_path;

              return (
                <Link
                  key={`${result.media_type}-${result.id}`}
                  className="search-result"
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
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
