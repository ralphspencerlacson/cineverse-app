import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEmbedUrl } from "../../service/vidapi/requests";
import "./VidPlayer.css";

const PROGRESS_STORAGE_KEY = "cineverse-vid-progress";
const MIN_SAVE_SECONDS = 1;
const RESUME_BACKTRACK_SECONDS = 5;

const getStorageMap = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const getStoredProgress = (key) => {
  const keys = Array.isArray(key) ? key : [key];

  if (!keys.length) {
    return 0;
  }

  const map = getStorageMap();

  for (const currentKey of keys) {
    const progress = Number(map[currentKey]);
    if (Number.isFinite(progress) && progress > 0) {
      return Math.floor(progress);
    }
  }

  return 0;
};

const setStoredProgress = (key, seconds) => {
  const keys = Array.isArray(key) ? key : [key];

  if (!keys.length || typeof window === "undefined") {
    return;
  }

  const progress = Number(seconds);
  if (!Number.isFinite(progress) || progress < MIN_SAVE_SECONDS) {
    return;
  }

  const map = getStorageMap();

  for (const currentKey of keys) {
    map[currentKey] = Math.floor(progress);
  }

  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    return;
  }
};

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

  const isControlled = typeof isOpen === "boolean";
  const showPlayer = isControlled ? isOpen : internalShowPlayer;

  const resumeAt = useMemo(() => {
    if (!progressKeys.length) {
      return 0;
    }

    const storedProgress = getStoredProgress(progressKeys);
    return Math.max(0, storedProgress - RESUME_BACKTRACK_SECONDS);
  }, [progressKeys]);

  const updateOpen = (value) => {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalShowPlayer(value);
    }
  };

  const handleOpen = () => updateOpen(true);
  const handleClose = () => updateOpen(false);

  const saveProgress = useCallback(() => {
    if (!showPlayer || !progressKeys.length || !sessionStartRef.current) {
      return;
    }

    const playedSeconds =
      baseProgressRef.current +
      Math.floor((Date.now() - sessionStartRef.current) / 1000);

    setStoredProgress(progressKeys, playedSeconds);
  }, [showPlayer, progressKeys]);

  useEffect(() => {
    if (!showPlayer) {
      return;
    }

    baseProgressRef.current = resumeAt;
    sessionStartRef.current = Date.now();

    progressIntervalRef.current = window.setInterval(() => {
      const playedSeconds =
        baseProgressRef.current +
        Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setStoredProgress(progressKeys, playedSeconds);
    }, 10000);

    visibilityHandlerRef.current = () => {
      if (document.visibilityState === "hidden") {
        saveProgress();
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
      sessionStartRef.current = null;
    };
  }, [showPlayer, progressKeys, saveProgress, resumeAt]);

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
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </>
  );
};

export default VidPlayer;
