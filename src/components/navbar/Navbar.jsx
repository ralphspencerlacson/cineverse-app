import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CineverseLogo from "../../assets/png/cineverse-hd-logo-transparent.png";
import "./Navbar.css";

const Navbar = () => {
  const [navbarClass, setNavbarClass] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setNavbarClass(true);
      } else {
        setNavbarClass(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  });

  return (
    <nav className={`nav ${navbarClass && "bg_black"}`}>
      <Link to={"/"}>
        <img className="logo" src={CineverseLogo} alt="cineverse_logo" />
      </Link>

      <div className="links">
        <Link to={"/"}>
          <h4>Home</h4>
        </Link>
        <Link to={"/movies"}>
          <h4>Movies</h4>
        </Link>
        <Link to={"/series"}>
          <h4>Series</h4>
        </Link>
        <Link to={"/watchlist"}>
          <h4>Watchlist</h4>
        </Link>
        <Link to={"/blogs"}>
          <h4>Blogs</h4>
        </Link>
        <Link to={"/news"}>
          <h4>News</h4>
        </Link>
      </div>

      <div></div>
    </nav>
  );
};

export default Navbar;
