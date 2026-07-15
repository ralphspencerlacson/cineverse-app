import { useEffect, useMemo, useRef, useState } from "react";
import ShowDetails from "../../showDetails/ShowDetails";
import { useFetchApi } from "../../../hooks/useFetchApi";
import { getSeriesTrailers } from "../../../service/tmdb/requests";

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

const SlideItem = ({ showType, data, shouldLoadVideo = true, useFixedBackground = true }) => {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const iframeRef = useRef(null);
  const { apiData: trailer } = useFetchApi(
    shouldLoadVideo && data?.id ? getSeriesTrailers(showType, data.id) : null,
    "tmdb"
  );

  const trailerKey = useMemo(() => {
    return selectBestTrailer(trailer?.results)?.key;
  }, [trailer]);

  const trailerUrl = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&playsinline=1&rel=0&modestbranding=1&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
    : null;

  useEffect(() => {
    setIsVideoReady(false);
  }, [trailerUrl]);

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
        const playerState = message?.info?.playerState;

        if (playerState === 1) {
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
    <>
      {data && (
        <div
          key={data?.id}
          className={`slide `}
          style={{
            backgroundImage: `url(${TMDB_ASSET_BASEURL}${data?.backdrop_path})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            backgroundAttachment: useFixedBackground ? "fixed" : "scroll",
          }}
        >
          {shouldLoadVideo && trailerUrl && (
            <iframe
              ref={iframeRef}
              className={`slide__video ${isVideoReady ? "ready" : ""}`}
              src={trailerUrl}
              title="Background trailer"
              allow="autoplay; encrypted-media; picture-in-picture"
              tabIndex="-1"
              aria-hidden="true"
              onLoad={handleVideoLoad}
            />
          )}
          <div className="slide__overlay" />
          <div className="container">
            <div className="wrapper">
              {data?.kicker && <p className="slide__kicker">{data.kicker}</p>}
              <ShowDetails
                showType={showType}
                tmdbID={data.id}
                allowLinkTitle={false}
                showData={data}
                showWatchButton={false}
                variant="hero"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SlideItem;
