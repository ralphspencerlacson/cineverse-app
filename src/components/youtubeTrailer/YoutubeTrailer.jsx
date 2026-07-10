import { useEffect, useRef, useState } from "react";
// Hooks
import { useFetchApi } from "../../hooks/useFetchApi";
// Service
import { getSeriesTrailers } from "../../service/tmdb/requests";
// CSS
import "./YoutubeTrailer.css";

const YoutubeTrailer = ({ showType, tmdbID, title }) => {
  const [showTrailer, setShowTrailer] = useState(false);
  const iframeRef = useRef(null);
  const isPausedRef = useRef(false);

  const {
    isLoading,
    hasError,
    apiData: trailer,
  } = useFetchApi(getSeriesTrailers(showType, tmdbID), "tmdb");

  const getTrailer = () => {
    const trailerVideo = trailer?.results.find(
      (video) => video?.type === "Trailer"
    );
    return trailerVideo;
  };

  const trailerKey = getTrailer()?.key;

  useEffect(() => {
    if (!showTrailer) {
      return undefined;
    }

    isPausedRef.current = false;

    const handleKeyDown = (event) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }

      event.preventDefault();
      isPausedRef.current = !isPausedRef.current;
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: "command",
          func: isPausedRef.current ? "pauseVideo" : "playVideo",
          args: [],
        }),
        "https://www.youtube.com"
      );
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showTrailer]);

  return (
    <>
      <a
        className="btn btn-trailer"
        onClick={() => setShowTrailer(!showTrailer)}
      >
        Trailer
      </a>

      {showTrailer && (
        <div className="trailer" onClick={() => setShowTrailer(false)}>
          <div className="container">
            {trailerKey && (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share autoplay"
                allowFullScreen
              ></iframe>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default YoutubeTrailer;
