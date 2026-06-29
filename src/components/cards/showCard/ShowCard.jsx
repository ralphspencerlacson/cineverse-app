import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { convertToSlug } from "../../../utils/StringUtils.js";
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
} from "../../../utils/WatchlistStorage.js";
import "./ShowCard.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const ShowCard = ({ show, cardType, showType }) => {
  const title = show.title || show.name || show.original_name;
  const detailPath = `/${showType === "tv" ? "series" : "movie"}/${show.id}-${convertToSlug(title)}`;
  const watchlistID = `${showType}:${show.id}`;
  const [isSavedToWatchlist, setIsSavedToWatchlist] = useState(false);

  useEffect(() => {
    setIsSavedToWatchlist(isInWatchlist(watchlistID));
  }, [watchlistID]);

  const handleWishlistClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isSavedToWatchlist) {
      removeFromWatchlist(watchlistID);
      setIsSavedToWatchlist(false);
      return;
    }

    addToWatchlist({
      id: watchlistID,
      tmdbID: show.id,
      type: showType,
      title,
      posterPath: show.poster_path || null,
      backdropPath: show.backdrop_path || null,
      releaseDate: show.first_air_date || show.release_date || null,
      tmdbStatus: null,
      totalSeasons: null,
      totalEpisodes: null,
      nextEpisodeDate: null,
      detailPath,
    });
    setIsSavedToWatchlist(true);
  };

  return (
    <article className={`show-card ${cardType}`}>
      <div
        className="card"
        style={{
          backgroundImage:
            show &&
            `url(${TMDB_ASSET_BASEURL}${cardType === "poster" ? show.poster_path : show.backdrop_path
            })`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      >
        <Link className="card__link" to={detailPath} aria-label={`Open ${title}`} />

        <button
          type="button"
          className={`card__wishlist ${isSavedToWatchlist ? "saved" : ""}`}
          onClick={handleWishlistClick}
          aria-label={isSavedToWatchlist ? `${title} is wishlisted` : `Add ${title} to wishlist`}
          title={isSavedToWatchlist ? "Wishlisted" : "Add to Wishlist"}
        >
          {isSavedToWatchlist ? "♥" : "♡"}
        </button>
      </div>

      <Link className="show-card__details" to={detailPath}>
        <h4>{title}</h4>
        {show.overview && <p>{show.overview}</p>}
      </Link>
    </article>
  );
};

export default ShowCard;
