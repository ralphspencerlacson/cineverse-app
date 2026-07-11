import { Link } from "react-router-dom";
import CineverseLogo from "../../../assets/png/cineverse-hd-logo-transparent.png";
import "./Sitemap.css";

const footerSections = [
  {
    title: "Browse",
    links: [
      { label: "Movies", to: "/movies" },
      { label: "Series", to: "/series" },
      { label: "Watchlist", to: "/watchlist" },
    ],
  },
  {
    title: "Cineverse",
    links: [
      { label: "Home", to: "/" },
      { label: "Blog", to: "/blogs" },
      { label: "News", to: "/news" },
    ],
  },
  {
    title: "Watch Better",
    featured: true,
    links: [
      { label: "Top Rated Movies", to: "/movies" },
      { label: "Trending Movies", to: "/movies" },
      { label: "Popular Shows", to: "/series" },
      { label: "Top Rated Shows", to: "/series" },
      { label: "Network Picks", to: "/series" },
      { label: "Saved Picks", to: "/watchlist" },
    ],
  },
];

const footerHighlights = [
  "Pick a mood",
  "Save the shortlist",
  "Continue anytime",
];

const Sitemap = () => {
  return (
    <section className="sitemap">
      <div className="sitemap__bridge" aria-label="Cineverse flow">
        {footerHighlights.map((highlight, index) => (
          <span key={highlight}>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            {highlight}
          </span>
        ))}
      </div>

      <div className="wrapper">
        <div className="sitemap__brand">
          <Link to={"/"} className="sitemap__logo-link">
            <img className="logo" src={CineverseLogo} alt="cineverse_logo" />
          </Link>
          <p className="sitemap__eyebrow">Your next watch starts here</p>
          <p className="sitemap__copy">
            Cineverse helps you discover movies and series, save what matters,
            and jump back into the stories you care about.
          </p>
          <div className="sitemap__badges" aria-label="Cineverse features">
            <span>Curated Picks</span>
            <span>Watch Progress</span>
            <span>Smart Watchlist</span>
          </div>
        </div>

        <div className="sitemap__links">
          {footerSections.map((section) => (
            <div
              className={`sitemap__section ${section.featured ? "featured" : ""}`}
              key={section.title}
            >
              <h3>{section.title}</h3>
              <ul>
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Sitemap;
