import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Hooks
import { useFetchApi } from "../../hooks/useFetchApi";
// Service
import { getSeriesTrailers } from "../../service/tmdb/requests";
// CSS
import "./YoutubeTrailer.css";

const YoutubeTrailer = ({ showType, tmdbID, title, label = "Trailer" }) => {
  const [showTrailer, setShowTrailer] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const iframeRef = useRef(null);
  const isPausedRef = useRef(false);
  const closeTimeoutRef = useRef(null);

  const { apiData: trailer } = useFetchApi(
    getSeriesTrailers(showType, tmdbID),
    "tmdb"
  );

  const getTrailer = () => {
    const trailerVideo = trailer?.results.find(
      (video) => video?.type === "Trailer"
    );
    return trailerVideo;
  };

  const trailerKey = getTrailer()?.key;

  const openTrailer = () => {
    window.clearTimeout(closeTimeoutRef.current);
    setIsClosing(false);
    setShowTrailer(true);
  };

  const closeTrailer = useCallback(() => {
    if (!showTrailer || isClosing) {
      return;
    }

    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      setShowTrailer(false);
      setIsClosing(false);
    }, 820);
  }, [isClosing, showTrailer]);

  useEffect(() => {
    if (!showTrailer) {
      return undefined;
    }

    isPausedRef.current = false;

    const handleKeyDown = (event) => {
      if (event.code === "Escape") {
        closeTrailer();
        return;
      }

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
  }, [closeTrailer, showTrailer]);

  useEffect(() => {
    if (!showTrailer) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.dispatchEvent(
      new CustomEvent("cineverse-trailer-state", { detail: { isOpen: true } })
    );

    return () => {
      document.body.style.overflow = previousOverflow;
      window.dispatchEvent(
        new CustomEvent("cineverse-trailer-state", { detail: { isOpen: false } })
      );
    };
  }, [showTrailer]);

  useEffect(() => {
    return () => window.clearTimeout(closeTimeoutRef.current);
  }, []);

  return (
    <>
      <button
        type="button"
        className="btn btn-trailer"
        onClick={openTrailer}
        aria-haspopup="dialog"
        aria-expanded={showTrailer}
      >
        {label}
      </button>

      {showTrailer && createPortal(
        <div
          className={`trailer ${isClosing ? "is-closing" : "is-opening"}`}
          onClick={closeTrailer}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} trailer`}
        >
          <div className="trailer__spotlight" aria-hidden="true"><i /></div>
          <div className="trailer__container" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="trailer__close"
              onClick={closeTrailer}
              aria-label="Close trailer"
            >
              <span />
              <span />
            </button>
            {trailerKey && (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&controls=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share autoplay"
                allowFullScreen
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default YoutubeTrailer;
