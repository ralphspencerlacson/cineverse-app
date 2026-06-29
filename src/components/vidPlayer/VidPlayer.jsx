import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEmbedUrl } from "../../service/vidapi/requests";
import {
  getStoredVideoProgress,
  setStoredVideoProgress,
} from "../../utils/VideoProgressStorage";
import "./VidPlayer.css";

const RESUME_BACKTRACK_SECONDS = 5;
const DEFAULT_COMPLETION_THRESHOLD = 0.9;
const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-presentation";

const buildProgressKeys = ({ type, tmdbID, imdbID, season, episode }) => {
  const ids = [];

  if (imdbID) {
    ids.push(String(imdbID));
  }

  if (tmdbID) {
    ids.push(String(tmdbID));
  }

  if (ids.length === 0) {
    return [];
  }

  const keys = ids.map((id) => {
    if (type === "tv" && season != null && episode != null) {
      return `${type}:${id}:s${season}:e${episode}`;
    }

    return `${type}:${id}`;
  });

  return Array.from(new Set(keys));
};

const VidPlayer = ({
  type,
  tmdbID,
  imdbID,
  season,
  episode,
  title,
  label = "Watch",
  className = "",
  showButton = true,
  isOpen,
  onOpenChange,
  runtimeMinutes,
  completionThreshold = DEFAULT_COMPLETION_THRESHOLD,
  onComplete,
  progressMetadata,
}) => {
  const [internalShowPlayer, setInternalShowPlayer] = useState(false);
  const progressKeys = useMemo(
    () =>
      buildProgressKeys({
        type,
        tmdbID,
        imdbID,
        season,
        episode,
      }),
    [type, tmdbID, imdbID, season, episode]
  );

  const sessionStartRef = useRef(null);
  const baseProgressRef = useRef(0);
  const progressIntervalRef = useRef(null);
  const visibilityHandlerRef = useRef(null);
  const completionMarkedRef = useRef(false);

  const isControlled = typeof isOpen === "boolean";
  const showPlayer = isControlled ? isOpen : internalShowPlayer;

  const resumeAt = useMemo(() => {
    if (!progressKeys.length) {
      return 0;
    }

    const storedProgress = getStoredVideoProgress(progressKeys);
    return Math.max(0, storedProgress - RESUME_BACKTRACK_SECONDS);
  }, [progressKeys]);

  const runtimeSeconds = useMemo(() => {
    const runtime = Number(runtimeMinutes);
    return Number.isFinite(runtime) && runtime > 0 ? runtime * 60 : 0;
  }, [runtimeMinutes]);

  const updateOpen = (value) => {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalShowPlayer(value);
    }
  };

  const handleOpen = () => updateOpen(true);
  const handleClose = () => updateOpen(false);

  const getPlayedSeconds = useCallback(() => {
    if (!sessionStartRef.current) {
      return baseProgressRef.current;
    }

    return (
      baseProgressRef.current +
      Math.floor((Date.now() - sessionStartRef.current) / 1000)
    );
  }, []);

  const saveProgress = useCallback(() => {
    if (!showPlayer || !progressKeys.length || !sessionStartRef.current) {
      return;
    }

    const playedSeconds = getPlayedSeconds();

    setStoredVideoProgress(progressKeys, playedSeconds, progressMetadata);
  }, [getPlayedSeconds, progressKeys, progressMetadata, showPlayer]);

  const maybeMarkComplete = useCallback(() => {
    if (
      completionMarkedRef.current ||
      !runtimeSeconds ||
      !sessionStartRef.current
    ) {
      return;
    }

    const playedSeconds = getPlayedSeconds();
    if (playedSeconds < runtimeSeconds * completionThreshold) {
      return;
    }

    completionMarkedRef.current = true;
    onComplete?.({ playedSeconds, runtimeSeconds });
  }, [completionThreshold, getPlayedSeconds, onComplete, runtimeSeconds]);

  useEffect(() => {
    completionMarkedRef.current = false;
  }, [type, tmdbID, imdbID, season, episode, runtimeSeconds]);

  useEffect(() => {
    if (!showPlayer) {
      return;
    }

    baseProgressRef.current = resumeAt;
    sessionStartRef.current = Date.now();

    progressIntervalRef.current = window.setInterval(() => {
      const playedSeconds = getPlayedSeconds();
      setStoredVideoProgress(progressKeys, playedSeconds, progressMetadata);
      maybeMarkComplete();
    }, 10000);

    visibilityHandlerRef.current = () => {
      if (document.visibilityState === "hidden") {
        saveProgress();
        maybeMarkComplete();
      }
    };

    window.addEventListener("beforeunload", saveProgress);
    window.addEventListener("pagehide", saveProgress);
    document.addEventListener("visibilitychange", visibilityHandlerRef.current);

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      window.removeEventListener("beforeunload", saveProgress);
      window.removeEventListener("pagehide", saveProgress);

      if (visibilityHandlerRef.current) {
        document.removeEventListener(
          "visibilitychange",
          visibilityHandlerRef.current
        );
        visibilityHandlerRef.current = null;
      }

      saveProgress();
      maybeMarkComplete();
      sessionStartRef.current = null;
    };
  }, [getPlayedSeconds, maybeMarkComplete, progressKeys, progressMetadata, saveProgress, showPlayer, resumeAt]);

  const embedUrl = getEmbedUrl({
    type,
    tmdbID,
    imdbID,
    season,
    episode,
    resumeAt,
  });

  if (!embedUrl) {
    return null;
  }

  return (
    <>
      {showButton && (
        <a
          className={`btn btn-watch ${className}`}
          onClick={handleOpen}
        >
          {label}
        </a>
      )}

      {showPlayer && (
        <div className="vid-player" onPointerDown={handleClose}>
            <div
              className="container"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <iframe
                src={embedUrl}
                loading="lazy"
                title={title}
                sandbox={IFRAME_SANDBOX}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin"
                allowFullScreen
              ></iframe>
            </div>
        </div>
      )}
    </>
  );
};

export default VidPlayer;
