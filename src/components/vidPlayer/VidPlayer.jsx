import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEmbedUrl } from "../../service/vidapi/requests";
import "./VidPlayer.css";

const PROGRESS_STORAGE_KEY = "cineverse-vid-progress";
const MIN_SAVE_SECONDS = 10;

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
  if (!key) {
    return 0;
  }

  const map = getStorageMap();
  const progress = Number(map[key]);

  return Number.isFinite(progress) && progress > 0 ? Math.floor(progress) : 0;
};

const setStoredProgress = (key, seconds) => {
  if (!key || typeof window === "undefined") {
    return;
  }

  const progress = Number(seconds);
  if (!Number.isFinite(progress) || progress < MIN_SAVE_SECONDS) {
    return;
  }

  const map = getStorageMap();
  map[key] = Math.floor(progress);

  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    return;
  }
};

const buildProgressKey = ({ type, tmdbID, imdbID, season, episode }) => {
  const id = imdbID || tmdbID;

  if (!id) {
    return "";
  }

  const normalizedId = String(id);

  if (type === "tv" && season != null && episode != null) {
    return `${type}:${normalizedId}:s${season}:e${episode}`;
  }

  return `${type}:${normalizedId}`;
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
  const progressKey = useMemo(
    () =>
      buildProgressKey({
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

  const resumeAt = progressKey ? getStoredProgress(progressKey) : 0;

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
    if (!showPlayer || !progressKey || !sessionStartRef.current) {
      return;
    }

    const playedSeconds =
      baseProgressRef.current +
      Math.floor((Date.now() - sessionStartRef.current) / 1000);

    setStoredProgress(progressKey, playedSeconds);
  }, [showPlayer, progressKey]);

  useEffect(() => {
    if (!showPlayer || !progressKey) {
      return;
    }

    baseProgressRef.current = resumeAt;
    sessionStartRef.current = Date.now();

    progressIntervalRef.current = window.setInterval(() => {
      const playedSeconds =
        baseProgressRef.current +
        Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setStoredProgress(progressKey, playedSeconds);
    }, 10000);

    visibilityHandlerRef.current = () => {
      if (document.visibilityState === "hidden") {
        saveProgress();
      }
    };

    window.addEventListener("beforeunload", saveProgress);
    document.addEventListener("visibilitychange", visibilityHandlerRef.current);

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      window.removeEventListener("beforeunload", saveProgress);

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
  }, [showPlayer, progressKey, saveProgress, resumeAt]);

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
        <div className="vid-player" onMouseDown={handleClose}>
          <div
            className="container"
            onMouseDown={(event) => event.stopPropagation()}
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
