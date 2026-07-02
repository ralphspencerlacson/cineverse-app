import Copyright from "./sub/Copyright";
import Sitemap from "./sub/Sitemap";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <Sitemap />
      <Copyright />
    </footer>
  );
};

export default Footer;
