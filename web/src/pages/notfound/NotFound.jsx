import { Link } from "react-router-dom";
import { FaArrowRight, FaHouse } from "react-icons/fa6";
import "./NotFound.css";

const NotFound = () => {
  return (
    <main className="notfound">
      <div className="notfound__beam" aria-hidden="true" />

      <section className="notfound__content" aria-labelledby="notfound-title">
        <p className="notfound__eyebrow"><span>Projection interrupted</span> Error 404</p>

        <div className="notfound__code" aria-hidden="true">
          <span>4</span>
          <span className="notfound__reel"><i /><i /><i /><i /><i /></span>
          <span>4</span>
        </div>

        <div className="notfound__copy">
          <h1 id="notfound-title">This scene isn&apos;t in the cut.</h1>
          <p>
            The reel may have moved, the link may be outdated, or this title
            never made it past the editing room.
          </p>
        </div>

        <div className="notfound__actions">
          <Link className="notfound__primary" to="/"><FaHouse aria-hidden="true" /> Return home</Link>
          <Link to="/movies">Browse movies <FaArrowRight aria-hidden="true" /></Link>
        </div>
      </section>

      <div className="notfound__timeline" aria-hidden="true">
        <span /><span /><span className="missing" /><span /><span />
      </div>
    </main>
  );
};

export default NotFound;
