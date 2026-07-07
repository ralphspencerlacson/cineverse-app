import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEmbedUrl as getVideasyEmbedUrl } from "../../service/videasy/requests";
import { getEmbedUrl as getVidapiEmbedUrl } from "../../service/vidapi/requests";
import {
  getStoredVideoProgress,
  setStoredVideoProgress,
} from "../../utils/VideoProgressStorage";
import { useAuth } from "../../context/AuthContext";
import "./VidPlayer.css";

const RESUME_BACKTRACK_SECONDS = 5;
const DEFAULT_COMPLETION_THRESHOLD = 0.9;
const PLAYER_LOAD_TIMEOUT_MS = 9000;
const PLAYER_PROVIDERS = [
  {
    key: "videasy",
    label: "Videasy",
    getEmbedUrl: getVideasyEmbedUrl,
  },
  {
    key: "vidapi",
    label: "VidAPI",
    getEmbedUrl: getVidapiEmbedUrl,
  },
];

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

const parseMaybeJson = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const findNumericField = (value, fieldNames) => {
  const parsedValue = parseMaybeJson(value);

  if (!parsedValue || typeof parsedValue !== "object") {
    return null;
  }

  for (const [key, currentValue] of Object.entries(parsedValue)) {
    if (fieldNames.includes(key)) {
      const numberValue = Number(currentValue);
      if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue;
      }
    }
  }

  for (const currentValue of Object.values(parsedValue)) {
    const nestedValue = findNumericField(currentValue, fieldNames);
    if (nestedValue) {
      return nestedValue;
    }
  }

  return null;
};

const getEpisodeChangeFromMessage = (message) => {
  const parsedMessage = parseMaybeJson(message);
  const nextSeason = findNumericField(parsedMessage, [
    "season",
    "seasonNumber",
    "currentSeason",
    "s",
  ]);
  const nextEpisode = findNumericField(parsedMessage, [
    "episode",
    "episodeNumber",
    "currentEpisode",
    "e",
  ]);

  if (!nextSeason || !nextEpisode) {
    return null;
  }

  return { season: nextSeason, episode: nextEpisode };
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
  onEpisodeChange,
  progressMetadata,
  getProgressMetadata,
}) => {
  const { isLoggedIn } = useAuth();
  const [internalShowPlayer, setInternalShowPlayer] = useState(false);
  const [activeProviderIndex, setActiveProviderIndex] = useState(0);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
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
  const playerLoadTimeoutRef = useRef(null);
  const lastReportedEpisodeRef = useRef(null);

  const isControlled = typeof isOpen === "boolean";
  const requestedShowPlayer = isControlled ? isOpen : internalShowPlayer;
  const showPlayer = isLoggedIn && requestedShowPlayer;

  const resumeAt = useMemo(() => {
    if (!progressKeys.length) {
      return 0;
    }

    const storedProgress = getStoredVideoProgress(progressKeys);
    return Math.max(0, storedProgress - RESUME_BACKTRACK_SECONDS);
  }, [progressKeys]);

  const playerOptions = useMemo(() => {
    return PLAYER_PROVIDERS.map((provider) => ({
      ...provider,
      embedUrl: provider.getEmbedUrl({
        type,
        tmdbID,
        imdbID,
        season,
        episode,
        resumeAt,
      }),
    })).filter((provider) => provider.embedUrl);
  }, [episode, imdbID, resumeAt, season, tmdbID, type]);

  const activeProvider =
    playerOptions[activeProviderIndex] || playerOptions[0] || null;
  const canSwitchPlayer = playerOptions.length > 1;

  const runtimeSeconds = useMemo(() => {
    const runtime = Number(runtimeMinutes);
    return Number.isFinite(runtime) && runtime > 0 ? runtime * 60 : 0;
  }, [runtimeMinutes]);

  const updateOpen = (value) => {
    window.dispatchEvent(
      new CustomEvent("cineverse-player-state", { detail: { isOpen: value } })
    );

    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalShowPlayer(value);
    }
  };

  const handleOpen = () => {
    if (!isLoggedIn) {
      return;
    }

    updateOpen(true);
  };
  const handleClose = () => updateOpen(false);

  useEffect(() => {
    if (isLoggedIn || !requestedShowPlayer) {
      return;
    }

    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalShowPlayer(false);
    }
  }, [isControlled, isLoggedIn, onOpenChange, requestedShowPlayer]);

  const clearPlayerLoadTimeout = useCallback(() => {
    if (playerLoadTimeoutRef.current) {
      window.clearTimeout(playerLoadTimeoutRef.current);
      playerLoadTimeoutRef.current = null;
    }
  }, []);

  const switchPlayer = useCallback(() => {
    if (!canSwitchPlayer) {
      return;
    }

    setActiveProviderIndex((currentIndex) =>
      (currentIndex + 1) % playerOptions.length
    );
  }, [canSwitchPlayer, playerOptions.length]);

  const handlePlayerLoad = () => {
    clearPlayerLoadTimeout();
    setIsPlayerLoading(false);
  };

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
    lastReportedEpisodeRef.current = `${season}:${episode}`;
  }, [type, tmdbID, imdbID, season, episode, runtimeSeconds]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cineverse-player-state", { detail: { isOpen: showPlayer } })
    );
  }, [showPlayer]);

  useEffect(() => {
    if (!showPlayer || type !== "tv") {
      return;
    }

    const handleMessage = (event) => {
      const episodeChange = getEpisodeChangeFromMessage(event.data);
      if (!episodeChange) {
        return;
      }

      const nextEpisodeKey = `${episodeChange.season}:${episodeChange.episode}`;
      if (nextEpisodeKey === lastReportedEpisodeRef.current) {
        return;
      }

      lastReportedEpisodeRef.current = nextEpisodeKey;

      const nextProgressKeys = buildProgressKeys({
        type,
        tmdbID,
        imdbID,
        season: episodeChange.season,
        episode: episodeChange.episode,
      });

      if (nextProgressKeys.length) {
        const nextMetadata = getProgressMetadata?.(episodeChange) || {
          ...progressMetadata,
          season: episodeChange.season,
          episode: episodeChange.episode,
        };

        setStoredVideoProgress(nextProgressKeys, 1, nextMetadata);
      }

      onEpisodeChange?.(episodeChange);
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [getProgressMetadata, imdbID, onEpisodeChange, progressMetadata, showPlayer, tmdbID, type]);

  useEffect(() => {
    setActiveProviderIndex(0);
  }, [type, tmdbID, imdbID, season, episode]);

  useEffect(() => {
    if (activeProviderIndex >= playerOptions.length) {
      setActiveProviderIndex(0);
    }
  }, [activeProviderIndex, playerOptions.length]);

  useEffect(() => {
    if (!showPlayer || !activeProvider) {
      setIsPlayerLoading(false);
      return;
    }

    setIsPlayerLoading(true);

    clearPlayerLoadTimeout();
    playerLoadTimeoutRef.current = window.setTimeout(() => {
      playerLoadTimeoutRef.current = null;
      setIsPlayerLoading(false);

      if (canSwitchPlayer) {
        switchPlayer();
      }
    }, PLAYER_LOAD_TIMEOUT_MS);

    return clearPlayerLoadTimeout;
  }, [activeProvider, canSwitchPlayer, clearPlayerLoadTimeout, showPlayer, switchPlayer]);

  useEffect(() => {
    if (!showPlayer) {
      return;
    }

    baseProgressRef.current = resumeAt;
    sessionStartRef.current = Date.now();

    if (progressKeys.length) {
      setStoredVideoProgress(progressKeys, Math.max(1, resumeAt || 1), progressMetadata);
    }

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

  if (!activeProvider) {
    return null;
  }

  return (
    <>
      {showButton && (
        <button
          type="button"
          className={`btn btn-watch ${className}`}
          onClick={handleOpen}
        >
          {label}
        </button>
      )}

      {showPlayer && (
        <div className="vid-player" onPointerDown={handleClose}>
            <div
              className="container"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {canSwitchPlayer && (
                <button
                  type="button"
                  className="vid-player__switch"
                  onClick={switchPlayer}
                >
                  {isPlayerLoading ? "Trying" : "Switch to"}{" "}
                  {playerOptions[(activeProviderIndex + 1) % playerOptions.length]?.label}
                </button>
              )}
              <iframe
                key={activeProvider.key}
                src={activeProvider.embedUrl}
                loading="lazy"
                title={title}
                onLoad={handlePlayerLoad}
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
