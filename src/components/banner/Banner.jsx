import { useEffect, useMemo, useState } from "react";
import Overlay from "../overlay/Overlay";
import { useFetchApi } from "../../hooks/useFetchApi";
import { getSeriesTrailers } from "../../service/tmdb/requests";
import "./Banner.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const ShowBanner = ({ imageUrl, size, showType, tmdbID }) => {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const canFetchTrailer = Boolean(showType && tmdbID);
  const { apiData: trailer } = useFetchApi(
    canFetchTrailer ? getSeriesTrailers(showType, tmdbID) : null,
    "tmdb"
  );

  const trailerKey = useMemo(() => {
    return trailer?.results?.find(
      (video) =>
        video?.site === "YouTube" &&
        (video?.type === "Trailer" || video?.type === "Teaser")
    )?.key;
  }, [trailer]);

  const trailerUrl = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&playsinline=1&rel=0&modestbranding=1&disablekb=1&fs=0`
    : null;

  useEffect(() => {
    setIsVideoReady(false);
  }, [trailerUrl]);

  return (
    <section
      className={`banner ${size}`}
      style={{
        backgroundImage: imageUrl && `url(${TMDB_ASSET_BASEURL}${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: size === "sm" ? "top center" : "center center",
      }}
    >
      {trailerUrl && (
        <iframe
          className={`banner__video ${isVideoReady ? "ready" : ""}`}
          src={trailerUrl}
          title="Background trailer"
          allow="autoplay; encrypted-media; picture-in-picture"
          tabIndex="-1"
          aria-hidden="true"
          onLoad={() => setIsVideoReady(true)}
        />
      )}
      <Overlay />
    </section>
  );
};

export default ShowBanner;
