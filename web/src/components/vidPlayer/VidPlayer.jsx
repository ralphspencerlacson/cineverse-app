import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEmbedUrl as getZxcstreamEmbedUrl } from "../../service/zxcstream/requests";
import { getEmbedUrl as getVideasyEmbedUrl } from "../../service/videasy/requests";
import { getEmbedUrl as getVidapiEmbedUrl } from "../../service/vidapi/requests";
import {
  getStoredVideoProgress,
  setStoredVideoProgress,
} from "../../service/videoProgress/videoProgressStorage";
import { useAuth } from "../../context/AuthContext";
import "./VidPlayer.css";

const RESUME_BACKTRACK_SECONDS = 5;
const DEFAULT_COMPLETION_THRESHOLD = 0.9;
const PLAYER_LOAD_TIMEOUT_MS = 9000;
const CONTROLS_IDLE_TIMEOUT_MS = 3000;
const PLAYER_PROVIDERS = [
  {
    key: "zxcstream",
    label: "ZXCStream",
    getEmbedUrl: getZxcstreamEmbedUrl,
  },
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
  const { isLoggedIn } = useAuth();
  const [internalShowPlayer, setInternalShowPlayer] = useState(false);
  const [activeProviderIndex, setActiveProviderIndex] = useState(0);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
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
  const controlsIdleTimeoutRef = useRef(null);
  const iframeRef = useRef(null);
  const providerProgressRef = useRef({ seconds: 0, duration: 0 });
  const isPlaybackPausedRef = useRef(false);

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
  const shouldShowControls = areControlsVisible || isPlaybackPaused || isPlayerLoading;

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

  const clearControlsIdleTimeout = useCallback(() => {
    if (controlsIdleTimeoutRef.current) {
      window.clearTimeout(controlsIdleTimeoutRef.current);
      controlsIdleTimeoutRef.current = null;
    }
  }, []);

  const revealControls = useCallback((keepVisible = false) => {
    setAreControlsVisible(true);
    clearControlsIdleTimeout();

    if (keepVisible || isPlaybackPausedRef.current) {
      return;
    }

    controlsIdleTimeoutRef.current = window.setTimeout(() => {
      setAreControlsVisible(false);
      controlsIdleTimeoutRef.current = null;
    }, CONTROLS_IDLE_TIMEOUT_MS);
  }, [clearControlsIdleTimeout]);

  const postPlaybackCommand = useCallback((command) => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) {
      return;
    }

    iframeWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: command === "pause" ? "pauseVideo" : "playVideo",
        args: [],
      }),
      "*"
    );
    iframeWindow.postMessage(
      { type: "PLAYER_COMMAND", data: { event: command } },
      "*"
    );
  }, []);

  const togglePlayback = useCallback(() => {
    isPlaybackPausedRef.current = !isPlaybackPausedRef.current;
    setIsPlaybackPaused(isPlaybackPausedRef.current);
    revealControls(isPlaybackPausedRef.current);
    postPlaybackCommand(isPlaybackPausedRef.current ? "pause" : "play");
  }, [postPlaybackCommand, revealControls]);

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

  useEffect(() => {
    if (!showPlayer) {
      return undefined;
    }

    isPlaybackPausedRef.current = false;
    setIsPlaybackPaused(false);
    revealControls();

    const handleWindowBlur = () => revealControls();

    const handleKeyDown = (event) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }

      event.preventDefault();
      togglePlayback();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [revealControls, showPlayer, togglePlayback]);

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

  const handleProviderChange = (event) => {
    setActiveProviderIndex(Number(event.target.value));
    revealControls();
  };

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

  const saveProgress = useCallback((progressSeconds) => {
    if (!showPlayer || !progressKeys.length || !sessionStartRef.current) {
      return;
    }

    const playedSeconds = Number.isFinite(Number(progressSeconds))
      ? Number(progressSeconds)
      : getPlayedSeconds();

    setStoredVideoProgress(progressKeys, playedSeconds, {
      ...(progressMetadata || {}),
      playbackSeconds: Math.floor(playedSeconds),
      ...(providerProgressRef.current.duration
        ? { playbackDuration: providerProgressRef.current.duration }
        : {}),
    });
  }, [getPlayedSeconds, progressKeys, progressMetadata, showPlayer]);

  const maybeMarkComplete = useCallback((progressSeconds, durationSeconds) => {
    if (
      completionMarkedRef.current ||
      !sessionStartRef.current
    ) {
      return;
    }

    const resolvedRuntimeSeconds = Number(durationSeconds) > 0
      ? Number(durationSeconds)
      : runtimeSeconds;

    if (!resolvedRuntimeSeconds) {
      return;
    }

    const playedSeconds = Number.isFinite(Number(progressSeconds))
      ? Number(progressSeconds)
      : getPlayedSeconds();

    if (playedSeconds < resolvedRuntimeSeconds * completionThreshold) {
      return;
    }

    completionMarkedRef.current = true;
    onComplete?.({ playedSeconds, runtimeSeconds: resolvedRuntimeSeconds });
  }, [completionThreshold, getPlayedSeconds, onComplete, runtimeSeconds]);

  const saveProviderProgress = useCallback((seconds, duration) => {
    const playedSeconds = Number(seconds);
    if (!showPlayer || !progressKeys.length || !Number.isFinite(playedSeconds) || playedSeconds < 1) {
      return;
    }

    const resolvedDuration = Number(duration);
    const durationSeconds = Number.isFinite(resolvedDuration) && resolvedDuration > 0
      ? resolvedDuration
      : 0;

    providerProgressRef.current = {
      seconds: playedSeconds,
      duration: durationSeconds || providerProgressRef.current.duration,
    };
    baseProgressRef.current = playedSeconds;
    sessionStartRef.current = Date.now();

    setStoredVideoProgress(progressKeys, playedSeconds, {
      ...(progressMetadata || {}),
      playbackSeconds: Math.floor(playedSeconds),
      ...(durationSeconds ? { playbackDuration: durationSeconds } : {}),
    });
    maybeMarkComplete(playedSeconds, durationSeconds);
  }, [maybeMarkComplete, progressKeys, progressMetadata, showPlayer]);

  const parsePlayerMessage = useCallback((eventData) => {
    if (!eventData) {
      return null;
    }

    let data = eventData;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return null;
      }
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    if (data.type === "PLAYER_EVENT") {
      const playerData = data.data || {};
      const playerProgress = Number(playerData.player_progress);
      const timestamp = Number(playerData.timestamp);
      const currentTime = Number(playerData.currentTime);
      const duration = Number(playerData.duration) || 0;
      const playerState = Number(playerData.playerState ?? playerData.state);
      const eventName = String(playerData.event || playerData.type || "").toLowerCase();
      const isPaused =
        playerData.paused === true ||
        playerData.isPaused === true ||
        playerState === 2 ||
        eventName === "pause" ||
        eventName === "paused";

      if (isPaused || playerState === 1 || eventName === "play" || eventName === "playing") {
        return {
          seconds: Number.isFinite(currentTime) && currentTime > 0 ? currentTime : playerProgress || timestamp || 0,
          duration,
          isPaused,
        };
      }

      if (Number.isFinite(playerProgress) && playerProgress > 0) {
        return { seconds: playerProgress, duration };
      }

      if (Number.isFinite(timestamp) && timestamp > 0) {
        return { seconds: timestamp, duration };
      }

      if (Number.isFinite(currentTime) && currentTime > 0) {
        return { seconds: currentTime, duration };
      }
    }

    const playerState = Number(data.info?.playerState ?? data.playerState ?? data.state);
    if (playerState === 1 || playerState === 2) {
      return {
        seconds: Number(data.timestamp) || 0,
        duration: Number(data.duration) || 0,
        isPaused: playerState === 2,
      };
    }

    const timestamp = Number(data.timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return {
        seconds: timestamp,
        duration: Number(data.duration) || 0,
      };
    }

    return null;
  }, []);

  useEffect(() => {
    completionMarkedRef.current = false;
    providerProgressRef.current = { seconds: 0, duration: 0 };
    clearControlsIdleTimeout();
    setAreControlsVisible(true);
    setIsPlaybackPaused(false);
    isPlaybackPausedRef.current = false;
  }, [clearControlsIdleTimeout, type, tmdbID, imdbID, season, episode, runtimeSeconds]);

  useEffect(() => {
    if (!showPlayer) {
      return undefined;
    }

    const handleProviderMessage = (event) => {
      const progress = parsePlayerMessage(event.data);
      if (!progress) {
        return;
      }

      if (typeof progress.isPaused === "boolean") {
        const wasPlaybackPaused = isPlaybackPausedRef.current;
        isPlaybackPausedRef.current = progress.isPaused;
        setIsPlaybackPaused(progress.isPaused);

        if (progress.isPaused || wasPlaybackPaused) {
          revealControls(progress.isPaused);
        }
      }

      if (progress.seconds > 0) {
        saveProviderProgress(progress.seconds, progress.duration);
      }
    };

    window.addEventListener("message", handleProviderMessage);

    return () => {
      window.removeEventListener("message", handleProviderMessage);
    };
  }, [parsePlayerMessage, revealControls, saveProviderProgress, showPlayer]);

  useEffect(() => {
    if (!showPlayer) {
      clearControlsIdleTimeout();
      setAreControlsVisible(true);
      setIsPlaybackPaused(false);
      return undefined;
    }

    revealControls();

    return clearControlsIdleTimeout;
  }, [clearControlsIdleTimeout, revealControls, showPlayer]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cineverse-player-state", { detail: { isOpen: showPlayer } })
    );
  }, [showPlayer]);

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
      const providerProgress = providerProgressRef.current;
      const playedSeconds = providerProgress.seconds || getPlayedSeconds();

      setStoredVideoProgress(progressKeys, playedSeconds, progressMetadata);
      maybeMarkComplete(
        providerProgress.seconds || undefined,
        providerProgress.duration || undefined
      );
    }, 10000);

    const persistCurrentProgress = () => {
      saveProgress(providerProgressRef.current.seconds || undefined);
    };

    visibilityHandlerRef.current = () => {
      if (document.visibilityState === "hidden") {
        persistCurrentProgress();
        maybeMarkComplete(
          providerProgressRef.current.seconds || undefined,
          providerProgressRef.current.duration || undefined
        );
      }
    };

    window.addEventListener("beforeunload", persistCurrentProgress);
    window.addEventListener("pagehide", persistCurrentProgress);
    document.addEventListener("visibilitychange", visibilityHandlerRef.current);

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      window.removeEventListener("beforeunload", persistCurrentProgress);
      window.removeEventListener("pagehide", persistCurrentProgress);

      if (visibilityHandlerRef.current) {
        document.removeEventListener(
          "visibilitychange",
          visibilityHandlerRef.current
        );
        visibilityHandlerRef.current = null;
      }

      saveProgress(providerProgressRef.current.seconds || undefined);
      maybeMarkComplete(
        providerProgressRef.current.seconds || undefined,
        providerProgressRef.current.duration || undefined
      );
      sessionStartRef.current = null;
    };
  }, [getPlayedSeconds, maybeMarkComplete, progressKeys, progressMetadata, saveProgress, showPlayer, resumeAt]);

  if (!activeProvider) {
    return null;
  }

  return (
    <>
      {showButton && isLoggedIn && (
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
            className="vid-player__shell"
            onPointerMove={() => revealControls()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className={`container ${shouldShowControls ? "show-controls" : "hide-controls"}`}>
              <div className="vid-player__controls">
                <button
                  type="button"
                  className="vid-player__close"
                  onClick={handleClose}
                  aria-label="Close video player"
                >
                  Close
                </button>
                {canSwitchPlayer && (
                  <label className="vid-player__provider">
                    <span>{isPlayerLoading ? "Trying" : "Server"}</span>
                    <select
                      className="vid-player__select"
                      value={activeProviderIndex}
                      onChange={handleProviderChange}
                      onFocus={() => revealControls(true)}
                      onBlur={() => revealControls()}
                    >
                      {playerOptions.map((provider, index) => (
                        <option value={index} key={provider.key}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <iframe
                key={activeProvider.key}
                src={activeProvider.embedUrl}
                loading="lazy"
                title={title}
                onLoad={handlePlayerLoad}
                ref={iframeRef}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VidPlayer;
