import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEmbedUrl as getZxcstreamEmbedUrl } from "../../service/zxcstream/requests";
import { getEmbedUrl as getVideasyEmbedUrl } from "../../service/videasy/requests";
import { getEmbedUrl as getVidapiEmbedUrl } from "../../service/vidapi/requests";
import {
  flushStoredVideoProgress,
  getStoredVideoProgressEntry,
  setStoredVideoProgress,
} from "../../service/videoProgress/videoProgressStorage";
import { useAuth } from "../../context/AuthContext";
import "./VidPlayer.css";

const RESUME_BACKTRACK_SECONDS = 5;
const DEFAULT_COMPLETION_THRESHOLD = 0.9;
const PLAYER_LOAD_TIMEOUT_MS = 9000;
const CONTROLS_IDLE_TIMEOUT_MS = 3000;
const SEEK_EVENT_GUARD_MS = 5000;
const MAX_REASONABLE_DURATION_SECONDS = 24 * 60 * 60;
const PLAYER_PROVIDERS = [
  {
    key: "zxcstream",
    label: "ZXCStream",
    getEmbedUrl: getZxcstreamEmbedUrl,
    supportsResume: false,
  },
  {
    key: "videasy",
    label: "Videasy",
    getEmbedUrl: getVideasyEmbedUrl,
    supportsResume: true,
  },
  {
    key: "vidapi",
    label: "VidAPI",
    getEmbedUrl: getVidapiEmbedUrl,
    supportsResume: true,
  },
];

const PROVIDER_ORDER_BY_TYPE = {
  movie: ["videasy", "vidapi", "zxcstream"],
  tv: ["vidapi", "videasy", "zxcstream"],
};

const getOrderedProviders = (type) => {
  const providerOrder = PROVIDER_ORDER_BY_TYPE[type] || [];

  return [...PLAYER_PROVIDERS].sort((providerA, providerB) => {
    const providerAIndex = providerOrder.indexOf(providerA.key);
    const providerBIndex = providerOrder.indexOf(providerB.key);

    return (providerAIndex === -1 ? PLAYER_PROVIDERS.length : providerAIndex) -
      (providerBIndex === -1 ? PLAYER_PROVIDERS.length : providerBIndex);
  });
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
  const [playerRevision, setPlayerRevision] = useState(0);
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
  const runtimeSeconds = useMemo(() => {
    const runtime = Number(runtimeMinutes);
    return Number.isFinite(runtime) && runtime > 0 ? runtime * 60 : 0;
  }, [runtimeMinutes]);
  const progressKeySignature = progressKeys.join("|");

  const sessionStartRef = useRef(null);
  const baseProgressRef = useRef(0);
  const progressIntervalRef = useRef(null);
  const visibilityHandlerRef = useRef(null);
  const completionMarkedRef = useRef(false);
  const playerLoadTimeoutRef = useRef(null);
  const controlsIdleTimeoutRef = useRef(null);
  const iframeRef = useRef(null);
  const providerProgressRef = useRef({ seconds: null, duration: 0 });
  const isPlaybackPausedRef = useRef(false);
  const resumeAtRef = useRef(0);
  const canonicalCheckpointRef = useRef(0);
  const knownDurationRef = useRef(runtimeSeconds);
  const lastProviderProgressRef = useRef(null);
  const recentSeekRef = useRef(null);
  const backwardCandidateRef = useRef(null);
  const hasProviderProgressRef = useRef(false);
  const wasShowingPlayerRef = useRef(false);
  const activeProgressKeyRef = useRef("");
  const progressMetadataRef = useRef(progressMetadata);
  progressMetadataRef.current = progressMetadata;

  const isControlled = typeof isOpen === "boolean";
  const requestedShowPlayer = isControlled ? isOpen : internalShowPlayer;
  const showPlayer = isLoggedIn && requestedShowPlayer;

  if (
    showPlayer &&
    (!wasShowingPlayerRef.current || activeProgressKeyRef.current !== progressKeySignature)
  ) {
    const storedEntry = getStoredVideoProgressEntry(progressKeys);
    const checkpoint = storedEntry?.seconds || 0;
    const storedDuration = Number(storedEntry?.metadata?.playbackDuration);

    canonicalCheckpointRef.current = checkpoint;
    baseProgressRef.current = checkpoint;
    resumeAtRef.current = Math.max(0, checkpoint - RESUME_BACKTRACK_SECONDS);
    knownDurationRef.current =
      (Number.isFinite(storedDuration) && storedDuration > 0 && storedDuration) ||
      runtimeSeconds;
  }
  wasShowingPlayerRef.current = showPlayer;
  activeProgressKeyRef.current = progressKeySignature;

  const resumeAt = resumeAtRef.current;

  const playerOptions = useMemo(() => {
    return getOrderedProviders(type).map((provider) => ({
      ...provider,
      embedUrl: provider.getEmbedUrl({
        type,
        tmdbID,
        imdbID,
        season,
        episode,
        resumeAt: provider.supportsResume ? resumeAt : 0,
      }),
    })).filter((provider) => provider.embedUrl);
  }, [episode, imdbID, resumeAt, season, tmdbID, type]);

  const activeProvider =
    playerOptions[activeProviderIndex] || playerOptions[0] || null;
  const activeProviderOrigin = useMemo(() => {
    if (!activeProvider?.embedUrl) {
      return null;
    }

    try {
      return new URL(activeProvider.embedUrl, window.location.href).origin;
    } catch {
      return null;
    }
  }, [activeProvider?.embedUrl]);
  const canSwitchPlayer = playerOptions.length > 1;
  const shouldShowControls = areControlsVisible || isPlaybackPaused || isPlayerLoading;

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
  const handleClose = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    updateOpen(false);
  };

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
    const willPause = !isPlaybackPausedRef.current;
    if (willPause && sessionStartRef.current) {
      baseProgressRef.current += Math.floor(
        (Date.now() - sessionStartRef.current) / 1000
      );
      sessionStartRef.current = null;
    } else if (!willPause) {
      sessionStartRef.current = Date.now();
    }

    isPlaybackPausedRef.current = willPause;
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

  const saveProgress = useCallback((progressSeconds, flushLocal = false) => {
    if (!showPlayer || !progressKeys.length) {
      return;
    }

    const hasExplicitProgress = progressSeconds !== undefined && progressSeconds !== null;
    const playedSeconds = hasExplicitProgress && Number.isFinite(Number(progressSeconds))
      ? Number(progressSeconds)
      : getPlayedSeconds();
    const duration = knownDurationRef.current || runtimeSeconds;

    setStoredVideoProgress(progressKeys, playedSeconds, {
      ...(progressMetadataRef.current || {}),
      playbackSeconds: Math.floor(playedSeconds),
      ...(duration ? { playbackDuration: duration } : {}),
    }, { flushLocal });
  }, [getPlayedSeconds, progressKeys, runtimeSeconds, showPlayer]);

  const maybeMarkComplete = useCallback((progressSeconds, durationSeconds) => {
    if (
      completionMarkedRef.current
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

  const saveProviderProgress = useCallback((seconds, duration, isSeek = false) => {
    const playedSeconds = Number(seconds);
    if (!showPlayer || !progressKeys.length || !Number.isFinite(playedSeconds) || playedSeconds < 0) {
      return;
    }

    const resolvedDuration = Number(duration);
    const durationSeconds = Number.isFinite(resolvedDuration) && resolvedDuration > 0
      ? resolvedDuration
      : knownDurationRef.current || runtimeSeconds;
    const lastProgress = lastProviderProgressRef.current;
    const backwardTolerance = Math.max(15, durationSeconds * 0.02);
    const recentSeek = recentSeekRef.current;

    if (!isSeek) {
      if (
        activeProvider?.supportsResume &&
        playedSeconds < canonicalCheckpointRef.current &&
        lastProgress === null
      ) {
        return;
      }
      if (
        recentSeek &&
        Date.now() - recentSeek.at < SEEK_EVENT_GUARD_MS &&
        Math.abs(playedSeconds - recentSeek.seconds) > backwardTolerance
      ) {
        return;
      }
      if (lastProgress !== null && playedSeconds < lastProgress - backwardTolerance) {
        const candidate = backwardCandidateRef.current;
        const corroboratesBackwardSeek =
          candidate &&
          Date.now() - candidate.at < 3000 &&
          Math.abs(candidate.seconds - playedSeconds) <= backwardTolerance;

        if (!corroboratesBackwardSeek) {
          backwardCandidateRef.current = { seconds: playedSeconds, at: Date.now() };
          return;
        }
      }
    } else {
      recentSeekRef.current = { seconds: playedSeconds, at: Date.now() };
    }

    backwardCandidateRef.current = null;

    providerProgressRef.current = {
      seconds: playedSeconds,
      duration: durationSeconds,
    };
    hasProviderProgressRef.current = true;
    lastProviderProgressRef.current = playedSeconds;
    canonicalCheckpointRef.current = playedSeconds;
    knownDurationRef.current = durationSeconds;
    baseProgressRef.current = playedSeconds;
    sessionStartRef.current = isPlaybackPausedRef.current ? null : Date.now();

    setStoredVideoProgress(progressKeys, playedSeconds, {
      ...(progressMetadataRef.current || {}),
      playbackSeconds: Math.floor(playedSeconds),
      ...(durationSeconds ? { playbackDuration: durationSeconds } : {}),
    });
    maybeMarkComplete(playedSeconds, durationSeconds);
  }, [activeProvider?.supportsResume, maybeMarkComplete, progressKeys, runtimeSeconds, showPlayer]);

  const refreshResumeCheckpoint = useCallback(() => {
    const currentProgress = getPlayedSeconds();
    if (activeProvider?.supportsResume || hasProviderProgressRef.current) {
      saveProgress(currentProgress, true);
    }

    const storedEntry = getStoredVideoProgressEntry(progressKeys);
    const checkpoint = storedEntry?.seconds || 0;
    const storedDuration = Number(storedEntry?.metadata?.playbackDuration);
    canonicalCheckpointRef.current = checkpoint;
    baseProgressRef.current = checkpoint;
    resumeAtRef.current = Math.max(0, checkpoint - RESUME_BACKTRACK_SECONDS);
    knownDurationRef.current =
      (Number.isFinite(storedDuration) && storedDuration > 0 && storedDuration) ||
      knownDurationRef.current ||
      runtimeSeconds;
    providerProgressRef.current = { seconds: null, duration: knownDurationRef.current };
    hasProviderProgressRef.current = false;
    lastProviderProgressRef.current = null;
    recentSeekRef.current = null;
    backwardCandidateRef.current = null;
    sessionStartRef.current = isPlaybackPausedRef.current ? null : Date.now();
    setPlayerRevision((revision) => revision + 1);
  }, [activeProvider?.supportsResume, getPlayedSeconds, progressKeys, runtimeSeconds, saveProgress]);

  const switchPlayer = useCallback(() => {
    if (!canSwitchPlayer) {
      return;
    }

    refreshResumeCheckpoint();
    setActiveProviderIndex((currentIndex) =>
      (currentIndex + 1) % playerOptions.length
    );
  }, [canSwitchPlayer, playerOptions.length, refreshResumeCheckpoint]);

  const handleProviderChange = (event) => {
    refreshResumeCheckpoint();
    setActiveProviderIndex(Number(event.target.value));
    revealControls();
  };

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

    const playerData = data.type === "PLAYER_EVENT" ? data.data || {} : data;
    const toFiniteNumber = (value) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const reportedDuration = toFiniteNumber(playerData.duration);
    const duration =
      reportedDuration > 0 && reportedDuration <= MAX_REASONABLE_DURATION_SECONDS
        ? reportedDuration
        : knownDurationRef.current || runtimeSeconds;
    const isReasonableTime = (value) => {
      if (value === null || value < 0 || value > MAX_REASONABLE_DURATION_SECONDS) {
        return false;
      }
      return !duration || value <= duration + Math.max(30, duration * 0.05);
    };
    const currentTime = toFiniteNumber(playerData.currentTime);
    const timestamp = toFiniteNumber(playerData.timestamp);
    const playerProgress = toFiniteNumber(playerData.player_progress);
    const seconds = [currentTime, timestamp, playerProgress].find(isReasonableTime);
    const playerState = Number(
      playerData.info?.playerState ?? playerData.playerState ?? playerData.state
    );
    const eventName = String(
      playerData.event || playerData.type || data.event || ""
    ).toLowerCase();
    const isPauseEvent =
      playerData.paused === true ||
      playerData.isPaused === true ||
      playerState === 2 ||
      eventName === "pause" ||
      eventName === "paused";
    const isPlayEvent =
      playerData.paused === false ||
      playerData.isPaused === false ||
      playerState === 1 ||
      eventName === "play" ||
      eventName === "playing";
    const isSeek = ["seek", "seeking", "seeked"].includes(eventName);

    if (seconds === undefined && !isPauseEvent && !isPlayEvent) {
      return null;
    }

    return {
      seconds: seconds ?? null,
      duration,
      ...(isPauseEvent || isPlayEvent ? { isPaused: isPauseEvent } : {}),
      isSeek,
    };
  }, [runtimeSeconds]);

  useEffect(() => {
    completionMarkedRef.current = false;
    providerProgressRef.current = { seconds: null, duration: knownDurationRef.current };
    hasProviderProgressRef.current = false;
    lastProviderProgressRef.current = null;
    recentSeekRef.current = null;
    backwardCandidateRef.current = null;
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
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (
        activeProviderOrigin &&
        event.origin !== "null" &&
        event.origin !== activeProviderOrigin
      ) {
        return;
      }

      const progress = parsePlayerMessage(event.data);
      if (!progress) {
        return;
      }

      if (typeof progress.isPaused === "boolean") {
        const wasPlaybackPaused = isPlaybackPausedRef.current;

        if (progress.isPaused && !wasPlaybackPaused && progress.seconds === null) {
          baseProgressRef.current = getPlayedSeconds();
          sessionStartRef.current = null;
        } else if (!progress.isPaused && wasPlaybackPaused) {
          sessionStartRef.current = Date.now();
        }

        isPlaybackPausedRef.current = progress.isPaused;
        setIsPlaybackPaused(progress.isPaused);

        if (progress.isPaused || wasPlaybackPaused) {
          revealControls(progress.isPaused);
        }
      }

      if (progress.seconds !== null) {
        saveProviderProgress(progress.seconds, progress.duration, progress.isSeek);
      }
    };

    window.addEventListener("message", handleProviderMessage);

    return () => {
      window.removeEventListener("message", handleProviderMessage);
    };
  }, [activeProviderOrigin, getPlayedSeconds, parsePlayerMessage, revealControls, saveProviderProgress, showPlayer]);

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
    if (!showPlayer || !activeProvider) {
      return;
    }

    if (activeProvider.supportsResume) {
      baseProgressRef.current = canonicalCheckpointRef.current;
      sessionStartRef.current = isPlaybackPausedRef.current ? null : Date.now();
    } else {
      baseProgressRef.current = 0;
      sessionStartRef.current = null;
    }

    progressIntervalRef.current = window.setInterval(() => {
      if (!activeProvider.supportsResume && !hasProviderProgressRef.current) {
        return;
      }

      const providerProgress = providerProgressRef.current;
      const playedSeconds = getPlayedSeconds();

      saveProgress(playedSeconds);
      maybeMarkComplete(
        playedSeconds,
        providerProgress.duration || undefined
      );
    }, 10000);

    const persistCurrentProgress = () => {
      if (!activeProvider.supportsResume && !hasProviderProgressRef.current) {
        flushStoredVideoProgress();
        return;
      }

      saveProgress(getPlayedSeconds(), true);
      flushStoredVideoProgress();
    };

    visibilityHandlerRef.current = () => {
      if (document.visibilityState === "hidden") {
        persistCurrentProgress();
        maybeMarkComplete(
          getPlayedSeconds(),
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

      persistCurrentProgress();
      maybeMarkComplete(
        getPlayedSeconds(),
        providerProgressRef.current.duration || undefined
      );
      sessionStartRef.current = null;
    };
  }, [activeProvider, getPlayedSeconds, maybeMarkComplete, progressKeys, saveProgress, showPlayer]);

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
        <div className="vid-player" onClick={handleClose}>
          <div
            className="vid-player__shell"
            onPointerMove={() => revealControls()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`container ${shouldShowControls ? "show-controls" : "hide-controls"}`}>
              <div className="vid-player__controls">
                <button
                  type="button"
                  className="vid-player__close"
                  onClick={handleClose}
                  onPointerDown={(event) => event.stopPropagation()}
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
                key={`${activeProvider.key}:${playerRevision}`}
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
