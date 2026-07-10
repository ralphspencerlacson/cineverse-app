import { useEffect, useMemo, useRef, useState } from "react";
import Overlay from "../overlay/Overlay";
import { useFetchApi } from "../../hooks/useFetchApi";
import { getSeriesTrailers } from "../../service/tmdb/requests";
import "./Banner.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const selectBestTrailer = (videos = []) => {
  const youtubeVideos = videos
    .filter(
      (video) =>
        video?.site === "YouTube" &&
        (video?.type === "Trailer" || video?.type === "Teaser")
    )
    .sort((first, second) => {
      if (first?.type !== second?.type) {
        return first?.type === "Trailer" ? -1 : 1;
      }

      if (first?.official !== second?.official) {
        return first?.official ? -1 : 1;
      }

      return (second?.size || 0) - (first?.size || 0);
    });

  return youtubeVideos[0];
};

const ShowBanner = ({ imageUrl, size, showType, tmdbID }) => {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const iframeRef = useRef(null);
  const canFetchTrailer = Boolean(showType && tmdbID);
  const { apiData: trailer } = useFetchApi(
    canFetchTrailer ? getSeriesTrailers(showType, tmdbID) : null,
    "tmdb"
  );

  const trailerKey = useMemo(() => {
    return selectBestTrailer(trailer?.results)?.key;
  }, [trailer]);

  const trailerUrl = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&playsinline=1&rel=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
    : null;

  useEffect(() => {
    setIsVideoReady(false);
  }, [trailerUrl]);

  useEffect(() => {
    const handlePlayerState = (event) => {
      setIsPlayerOpen(Boolean(event.detail?.isOpen));
    };

    window.addEventListener("cineverse-player-state", handlePlayerState);

    return () => window.removeEventListener("cineverse-player-state", handlePlayerState);
  }, []);

  useEffect(() => {
    if (!trailerUrl) {
      return;
    }

    const handleYoutubeMessage = (event) => {
      if (event.origin !== "https://www.youtube.com") {
        return;
      }

      try {
        const message = JSON.parse(event.data);

        if (message?.info?.playerState === 1) {
          setIsVideoReady(true);
        }

        if (message?.event === "onError") {
          setIsVideoReady(false);
        }
      } catch {
        return;
      }
    };

    window.addEventListener("message", handleYoutubeMessage);

    return () => window.removeEventListener("message", handleYoutubeMessage);
  }, [trailerUrl]);

  const handleVideoLoad = () => {
    window.setTimeout(() => setIsVideoReady(true), 900);

    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "mute", args: [] }),
      "https://www.youtube.com"
    );
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "https://www.youtube.com"
    );
  };

  return (
    <section
      className={`banner ${size}`}
      style={{
        backgroundImage: imageUrl && `url(${TMDB_ASSET_BASEURL}${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: size === "sm" ? "top center" : "center center",
      }}
    >
      {trailerUrl && !isPlayerOpen && (
        <iframe
          ref={iframeRef}
          className={`banner__video ${isVideoReady ? "ready" : ""}`}
          src={trailerUrl}
          title="Background trailer"
          allow="autoplay; encrypted-media; picture-in-picture"
          tabIndex="-1"
          aria-hidden="true"
          onLoad={handleVideoLoad}
        />
      )}
      <Overlay />
    </section>
  );
};

export default ShowBanner;
