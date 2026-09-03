import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaArrowUpRightFromSquare,
  FaBarsStaggered,
  FaBoxArchive,
  FaChevronDown,
  FaClockRotateLeft,
  FaEllipsis,
  FaFileArrowDown,
  FaFileArrowUp,
  FaMagnifyingGlass,
  FaPen,
  FaPlay,
  FaRotate,
  FaTrash,
  FaXmark,
} from "react-icons/fa6";
import {
  WATCH_STATUS_OPTIONS,
  getWatchlist,
  mergeWatchlist,
  removeFromWatchlist,
  syncWatchlistItemMetadata,
  updateWatchlistItem,
} from "../../service/watchlist/watchlistStorage";
import {
  getVideoProgressEntries,
  setStoredVideoProgress,
} from "../../service/videoProgress/videoProgressStorage";
import { formatDate } from "../../utils/DateUtils";
import instance from "../../service/tmdb/tmdb";
import { getSeriesSeasons, getShowDetails, getShowPreview } from "../../service/tmdb/requests";
import { useAuth } from "../../context/AuthContext";
import {
  getStoredWatchlistSyncStatus,
  syncWatchlistForUser,
} from "../../service/watchlist/watchlistSync";
import { syncVideoProgressForUser } from "../../service/videoProgress/videoProgressSync";
import NoImagePlaceholder from "../../assets/png/no_image_placeholder.png";
import "./WatchlistPage.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;
const WATCHLIST_BATCH_SIZE = 20;
const WATCHLIST_DENSITY_KEY = "cineverse-watchlist-density";
const STATUS_SORT_ORDER = { Ongoing: 0, Planned: 1, Completed: 2, Dropped: 3 };

const formatStoredDate = (date) => {
  if (!date) return "-";
  try {
    return formatDate(date) || "-";
  } catch {
    return "-";
  }
};

const formatProgressTime = (seconds) => {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = Math.floor(totalSeconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const formatSyncDateTime = (date) => {
  if (!date) return "Not synced yet";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return "Sync time unavailable";
  }
};

const getDisplayProgressStatus = (item) =>
  item.progressStatus === "Watching" ? "Ongoing" : item.progressStatus || "Planned";

const getStatusClassName = (status = "Planned") =>
  status.toLowerCase().replace(/\s+/g, "-");

const getCategoryLabel = (item) => (item.type === "tv" ? "Series" : "Movie");
const clampProgressPercent = (value) => Math.min(100, Math.max(0, value));

const usePlaceholderOnError = (event) => {
  if (event.currentTarget.dataset.fallbackApplied) return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = NoImagePlaceholder;
};

const formatRelativeDate = (date, type) => {
  if (!date) return type === "tv" ? "Schedule not announced" : "Release date unavailable";
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return "Date unavailable";
  const days = Math.round((target.getTime() - Date.now()) / 86400000);
  if (days === 0) return type === "tv" ? "Next episode today" : "Released today";
  if (days === 1) return type === "tv" ? "Next episode tomorrow" : "Releases tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 60) return `${type === "tv" ? "Next episode" : "Releases"} in ${days} days`;
  if (days < -1 && days > -60) return `${Math.abs(days)} days ago`;
  return formatStoredDate(date);
};

const getMovieProgress = (item, movieProgressByKey) => {
  if (getDisplayProgressStatus(item) === "Completed") {
    return { percent: 100, elapsed: 0, duration: 0 };
  }

  const entry = movieProgressByKey[item.id] || movieProgressByKey[`movie:${item.tmdbID}`];
  const elapsed = Number(entry?.metadata?.playbackSeconds || entry?.seconds || 0);
  const duration = Number(
    entry?.metadata?.playbackDuration || entry?.metadata?.duration || 0
  );
  const hasElapsed = Number.isFinite(elapsed) && elapsed > 0;
  const hasDuration = Number.isFinite(duration) && duration > 0;

  return {
    percent: hasElapsed && hasDuration ? clampProgressPercent((elapsed / duration) * 100) : null,
    elapsed: hasElapsed ? elapsed : 0,
    duration: hasDuration ? duration : 0,
  };
};

const getProgressPercent = (item, seasonEpisodeCounts, movieProgressByKey) => {
  const status = getDisplayProgressStatus(item);
  if (status === "Completed") return 100;
  if (item.type !== "tv") return getMovieProgress(item, movieProgressByKey).percent;

  const totalEpisodes = Number(item.totalEpisodes);
  const currentSeason = Number(item.currentSeason || 1);
  const currentEpisode = Number(item.currentEpisode || 1);
  if (Number.isFinite(totalEpisodes) && totalEpisodes > 0) {
    let watchedBeforeSeason = 0;
    for (let season = 1; season < currentSeason; season += 1) {
      const count = seasonEpisodeCounts[`${item.id}:${season}`];
      if (!count || count < 0) return null;
      watchedBeforeSeason += count;
    }
    return clampProgressPercent(
      ((watchedBeforeSeason + currentEpisode - 1) / totalEpisodes) * 100
    );
  }

  const totalSeasons = Number(item.totalSeasons);
  return Number.isFinite(totalSeasons) && totalSeasons > 0
    ? clampProgressPercent(((currentSeason - 1) / totalSeasons) * 100)
    : null;
};

const getItemDetailPath = (item) => {
  if (!item?.detailPath) return "/";
  if (item.type !== "tv") return item.detailPath;
  const params = new URLSearchParams();
  if (item.currentSeason) params.set("season", item.currentSeason);
  if (item.currentEpisode) params.set("episode", item.currentEpisode);
  return params.size ? `${item.detailPath}?${params}` : item.detailPath;
};

const selectBestTrailer = (videos = []) =>
  videos
    .filter(
      (video) =>
        video?.site === "YouTube" &&
        (video?.type === "Trailer" || video?.type === "Teaser")
    )
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "Trailer" ? -1 : 1;
      if (a.official !== b.official) return a.official ? -1 : 1;
      return (b.size || 0) - (a.size || 0);
    })[0];

const WatchlistPage = () => {
  const { isLoggedIn, user } = useAuth();
  const [items, setItems] = useState(() => getWatchlist());
  const [videoProgressEntries, setVideoProgressEntries] = useState(() =>
    getVideoProgressEntries()
  );
  const [message, setMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState({ state: "idle", syncedAt: null, error: "" });
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [titleFilter, setTitleFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "progressStatus", direction: "asc" });
  const [visibleCount, setVisibleCount] = useState(WATCHLIST_BATCH_SIZE);
  const [seasonEpisodeCounts, setSeasonEpisodeCounts] = useState({});
  const [panel, setPanel] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [previewCache, setPreviewCache] = useState({});
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [density, setDensity] = useState(() => {
    try {
      return window.localStorage.getItem(WATCHLIST_DENSITY_KEY) === "compact"
        ? "compact"
        : "comfortable";
    } catch {
      return "comfortable";
    }
  });
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const progressInputRef = useRef(null);
  const openerRef = useRef(null);
  const movieRuntimeFetchesRef = useRef(new Set());

  const movieProgressByKey = useMemo(
    () =>
      videoProgressEntries.reduce((map, entry) => {
        if (entry.key?.startsWith("movie:")) map[entry.key] = entry;
        return map;
      }, {}),
    [videoProgressEntries]
  );

  const dashboardStats = useMemo(() => {
    const movies = items.filter((item) => item.type === "movie");
    const series = items.filter((item) => item.type === "tv");
    const completedMovies = movies.filter(
      (item) => getDisplayProgressStatus(item) === "Completed"
    ).length;
    const completedSeries = series.filter(
      (item) => getDisplayProgressStatus(item) === "Completed"
    ).length;
    const lastVideoWatched = [...videoProgressEntries]
      .filter((entry) => entry.metadata?.title)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
    return {
      moviesTotal: movies.length,
      seriesTotal: series.length,
      completedMovies,
      completedSeries,
      moviePercent: movies.length ? (completedMovies / movies.length) * 100 : 0,
      seriesPercent: series.length ? (completedSeries / series.length) * 100 : 0,
      lastVideoWatched,
    };
  }, [items, videoProgressEntries]);

  const visibleItems = useMemo(() => {
    const query = titleFilter.trim().toLowerCase();
    const filtered = items.filter(
      (item) =>
        (typeFilter === "all" || item.type === typeFilter) &&
        (statusFilter === "all" || getDisplayProgressStatus(item) === statusFilter) &&
        (!query || item.title.toLowerCase().includes(query))
    );

    return [...filtered].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      let result;
      if (sortConfig.key === "title") result = a.title.localeCompare(b.title);
      else if (sortConfig.key === "customSort") {
        result = (a.customSort || "zzz").localeCompare(b.customSort || "zzz");
      } else if (sortConfig.key === "progressStatus") {
        result =
          (STATUS_SORT_ORDER[getDisplayProgressStatus(a)] ?? 99) -
          (STATUS_SORT_ORDER[getDisplayProgressStatus(b)] ?? 99);
      } else if (sortConfig.key === "progress") {
        result =
          (getProgressPercent(a, seasonEpisodeCounts, movieProgressByKey) ?? -1) -
          (getProgressPercent(b, seasonEpisodeCounts, movieProgressByKey) ?? -1);
      } else if (sortConfig.key === "nextRelease") {
        const aDate = new Date(a.type === "tv" ? a.nextEpisodeDate || 0 : a.releaseDate || 0);
        const bDate = new Date(b.type === "tv" ? b.nextEpisodeDate || 0 : b.releaseDate || 0);
        result = aDate - bDate;
      } else {
        result = new Date(a.updatedAt || a.addedAt || 0) - new Date(b.updatedAt || b.addedAt || 0);
      }
      if (result === 0) result = a.title.localeCompare(b.title);
      return result * direction;
    });
  }, [items, movieProgressByKey, seasonEpisodeCounts, sortConfig, statusFilter, titleFilter, typeFilter]);

  const paginatedItems = visibleItems.slice(0, visibleCount);
  const activeItem = panel ? items.find((item) => item.id === panel.itemId) : null;
  const activePreview = activeItem ? previewCache[activeItem.id] : null;
  const hasActiveFilters =
    Boolean(titleFilter.trim()) || typeFilter !== "all" || statusFilter !== "all";
  const closeOverflowMenus = useCallback(() => {
    document.querySelectorAll(".watchlist-overflow[open]").forEach((menu) => {
      menu.removeAttribute("open");
    });
  }, []);

  const featureItem = useMemo(() => {
    if (!items.length) return null;
    const lastVideo = dashboardStats.lastVideoWatched;
    const lastMatch = lastVideo
      ? items.find(
          (item) =>
            item.title === lastVideo.metadata?.title ||
            (item.detailPath && lastVideo.metadata?.detailPath?.startsWith(item.detailPath))
        )
      : null;
    if (lastMatch) return lastMatch;
    return [...items]
      .filter((item) => getDisplayProgressStatus(item) === "Ongoing")
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || items[0];
  }, [dashboardStats.lastVideoWatched, items]);

  const featureProgress = featureItem
    ? getProgressPercent(featureItem, seasonEpisodeCounts, movieProgressByKey)
    : null;
  const lastVideo = dashboardStats.lastVideoWatched;
  const featureVideo =
    featureItem &&
    (featureItem.title === lastVideo?.metadata?.title ||
      (featureItem.detailPath && lastVideo?.metadata?.detailPath?.startsWith(featureItem.detailPath)))
      ? lastVideo
      : null;
  const featurePath =
    featureVideo?.metadata?.detailPath &&
    (featureItem?.title === featureVideo.metadata?.title ||
      featureVideo.metadata.detailPath.startsWith(featureItem?.detailPath || "__no-match__"))
      ? featureVideo.metadata.detailPath
      : featureItem
        ? getItemDetailPath(featureItem)
        : "/";
  const featureCanContinue = Boolean(
    featureVideo?.seconds ||
    (featureItem && getDisplayProgressStatus(featureItem) === "Ongoing")
  );

  const getSeasonEpisodeCount = useCallback(
    async (item, season) => {
      const cacheKey = `${item.id}:${season}`;
      if (seasonEpisodeCounts[cacheKey] !== undefined) {
        return Math.max(0, seasonEpisodeCounts[cacheKey]);
      }
      try {
        const response = await instance.get(getSeriesSeasons(item.tmdbID, season));
        const count = response.data?.episodes?.length || 0;
        setSeasonEpisodeCounts((current) => ({ ...current, [cacheKey]: count || -1 }));
        return count;
      } catch {
        setSeasonEpisodeCounts((current) => ({ ...current, [cacheKey]: -1 }));
        return 0;
      }
    },
    [seasonEpisodeCounts]
  );

  const closePanel = useCallback(() => {
    setPanel(null);
    setEditDraft(null);
    setPreviewPlaying(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    setVisibleCount(WATCHLIST_BATCH_SIZE);
  }, [sortConfig, statusFilter, titleFilter, typeFilter]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WATCHLIST_DENSITY_KEY, density);
    } catch {
      // The preference is optional when storage is unavailable.
    }
  }, [density]);

  useEffect(() => {
    setItems(getWatchlist());
    setVideoProgressEntries(getVideoProgressEntries());
    setSyncStatus(getStoredWatchlistSyncStatus(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const handleWatchlistSync = (event) => setItems(event.detail?.items || getWatchlist());
    const handleSyncStatus = (event) => {
      if (event.detail?.userID && event.detail.userID !== user?.id) return;
      setSyncStatus((current) => ({ ...current, ...event.detail }));
    };
    window.addEventListener("cineverse-watchlist-change", handleWatchlistSync);
    window.addEventListener("cineverse-watchlist-sync", handleWatchlistSync);
    window.addEventListener("cineverse-watchlist-sync-status", handleSyncStatus);
    return () => {
      window.removeEventListener("cineverse-watchlist-change", handleWatchlistSync);
      window.removeEventListener("cineverse-watchlist-sync", handleWatchlistSync);
      window.removeEventListener("cineverse-watchlist-sync-status", handleSyncStatus);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleProgress = () => setVideoProgressEntries(getVideoProgressEntries());
    window.addEventListener("cineverse-video-progress", handleProgress);
    window.addEventListener("storage", handleProgress);
    return () => {
      window.removeEventListener("cineverse-video-progress", handleProgress);
      window.removeEventListener("storage", handleProgress);
    };
  }, []);

  useEffect(() => {
    paginatedItems.forEach((item) => {
      if (item.type !== "tv") return;
      const currentSeason = Number(item.currentSeason || 1);
      for (let season = 1; season <= currentSeason; season += 1) {
        if (seasonEpisodeCounts[`${item.id}:${season}`] === undefined) {
          getSeasonEpisodeCount(item, season);
        }
      }
    });
  }, [getSeasonEpisodeCount, paginatedItems, seasonEpisodeCounts]);

  useEffect(() => {
    paginatedItems.forEach((item) => {
      if (item.type !== "movie" || movieRuntimeFetchesRef.current.has(item.id)) return;

      const progressEntry =
        movieProgressByKey[item.id] || movieProgressByKey[`movie:${item.tmdbID}`];
      const playedSeconds = Number(progressEntry?.seconds || 0);
      const knownDuration = Number(
        progressEntry?.metadata?.playbackDuration || progressEntry?.metadata?.duration || 0
      );
      if (!progressEntry || playedSeconds <= 0 || knownDuration > 0) return;

      movieRuntimeFetchesRef.current.add(item.id);
      instance.get(getShowDetails("movie", item.tmdbID)).then((response) => {
        const runtimeMinutes = Number(response.data?.runtime || 0);
        if (!Number.isFinite(runtimeMinutes) || runtimeMinutes <= 0) return;

        setStoredVideoProgress(
          progressEntry.key,
          playedSeconds,
          { playbackDuration: runtimeMinutes * 60 },
          { flushLocal: true, preserveUpdatedAt: true }
        );
      }).catch(() => {
        // A watched-time-only label remains useful when TMDB has no runtime.
      });
    });
  }, [movieProgressByKey, paginatedItems]);

  useEffect(() => {
    if (panel?.type !== "edit" || !activeItem || activeItem.type !== "tv" || !editDraft) {
      return;
    }
    getSeasonEpisodeCount(activeItem, Number(editDraft.currentSeason || 1));
  }, [activeItem, editDraft, getSeasonEpisodeCount, panel?.type]);

  useEffect(() => {
    if (!panel) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, panel]);

  useEffect(() => {
    if (panel && !activeItem) {
      closePanel();
    }
  }, [activeItem, closePanel, panel]);

  useEffect(() => {
    if (panel?.focus !== "progress" || activeItem?.type !== "tv") return undefined;
    const focusFrame = window.requestAnimationFrame(() => progressInputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [activeItem?.type, panel]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest(".watchlist-overflow")) {
        closeOverflowMenus();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeOverflowMenus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOverflowMenus]);

  const openEdit = (item, event, focus = "general") => {
    const menu = event.currentTarget.closest("details");
    openerRef.current = menu?.querySelector("summary") || event.currentTarget;
    closeOverflowMenus();
    setEditDraft({
      customSort: item.customSort || "",
      progressStatus: getDisplayProgressStatus(item),
      currentSeason: Number(item.currentSeason || 1),
      currentEpisode: Number(item.currentEpisode || 1),
    });
    setPanel({ type: "edit", itemId: item.id, focus });
  };

  const openPreview = async (item, event) => {
    const menu = event.currentTarget.closest("details");
    openerRef.current = menu?.querySelector("summary") || event.currentTarget;
    closeOverflowMenus();
    setPreviewPlaying(false);
    setPanel({ type: "preview", itemId: item.id });
    if (previewCache[item.id]?.isLoaded) return;
    setPreviewCache((current) => ({
      ...current,
      [item.id]: { isLoading: true, overview: item.overview, backdropPath: item.backdropPath },
    }));
    try {
      const response = await instance.get(getShowPreview(item.type, item.tmdbID));
      const details = response.data || {};
      const trailer = selectBestTrailer(details.videos?.results);
      setItems(
        syncWatchlistItemMetadata(item.id, {
          tmdbStatus: details.status || null,
          totalSeasons: details.number_of_seasons || item.totalSeasons,
          totalEpisodes: details.number_of_episodes || item.totalEpisodes,
          nextEpisodeDate: details.next_episode_to_air?.air_date || null,
        })
      );
      setPreviewCache((current) => ({
        ...current,
        [item.id]: {
          isLoading: false,
          isLoaded: true,
          overview: details.overview || item.overview || "No description available yet.",
          trailerKey: trailer?.key || null,
          backdropPath: details.backdrop_path || item.backdropPath,
        },
      }));
    } catch {
      setPreviewCache((current) => ({
        ...current,
        [item.id]: {
          isLoading: false,
          isLoaded: true,
          overview: item.overview || "Preview unavailable right now.",
          trailerKey: null,
          backdropPath: item.backdropPath,
        },
      }));
    }
  };

  const saveEdit = async () => {
    if (!activeItem || !editDraft) return;
    const updates = {
      customSort: editDraft.customSort.trim(),
      progressStatus: editDraft.progressStatus,
    };
    if (activeItem.type === "tv") {
      let season = Math.max(1, Number(editDraft.currentSeason) || 1);
      if (activeItem.totalSeasons) season = Math.min(season, activeItem.totalSeasons);
      const episodeCount = await getSeasonEpisodeCount(activeItem, season);
      let episode = Math.max(1, Number(editDraft.currentEpisode) || 1);
      if (episodeCount) episode = Math.min(episode, episodeCount);
      updates.currentSeason = season;
      updates.currentEpisode = episode;
      if (updates.progressStatus === "Completed") {
        const finalSeason = Number(activeItem.totalSeasons || season);
        const finalEpisodeCount = await getSeasonEpisodeCount(activeItem, finalSeason);
        updates.currentSeason = finalSeason;
        updates.currentEpisode = finalEpisodeCount || episode;
      }
    }
    setItems(updateWatchlistItem(activeItem.id, updates));
    setMessage(`Saved changes to "${activeItem.title}".`);
    closePanel();
  };

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortLabel = (label, key) => (
    <button
      type="button"
      className="watchlist-sort-button"
      onClick={() => handleSort(key)}
      aria-label={`${label}, ${sortConfig.key === key ? `sorted ${sortConfig.direction === "asc" ? "ascending" : "descending"}` : "not sorted"}`}
    >
      {label}
      <span aria-hidden="true">
        {sortConfig.key === key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  const handleRemove = (item) => {
    if (!window.confirm(`Remove "${item.title}" from your watchlist?`)) return;
    setItems(removeFromWatchlist(item.id));
    setMessage("Removed from watchlist.");
  };

  const handleExport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cineverse-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Watchlist exported.");
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const importedItems = JSON.parse(await file.text());
      if (!Array.isArray(importedItems)) throw new Error("Invalid watchlist format");
      setItems(mergeWatchlist(importedItems));
      setMessage("Watchlist imported and merged.");
    } catch {
      setMessage("Import failed. Please choose a valid watchlist JSON file.");
    } finally {
      event.target.value = "";
    }
  };

  const handleManualSync = async () => {
    if (!user?.id || syncStatus.state === "syncing") return;
    try {
      await Promise.all([syncWatchlistForUser(user.id), syncVideoProgressForUser(user.id)]);
    } catch {
      return;
    }
  };

  const renderProgress = (item) => {
    const percent = getProgressPercent(item, seasonEpisodeCounts, movieProgressByKey);
    const status = getDisplayProgressStatus(item);
    if (item.type === "tv") {
      return (
        <div className="watchlist-progress">
          <strong>{percent === null ? "Progress unknown" : `${Math.round(percent)}%`}</strong>
          <span>S{item.currentSeason || 1} · E{item.currentEpisode || 1}</span>
          {percent !== null && (
            <div className="watchlist-progress-bar" role="progressbar" aria-label={`${item.title} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(percent)}>
              <span style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      );
    }
    const movieProgress = getMovieProgress(item, movieProgressByKey);
    const detail = movieProgress.elapsed
      ? movieProgress.duration
        ? `${formatProgressTime(movieProgress.elapsed)} / ${formatProgressTime(movieProgress.duration)}`
        : `${formatProgressTime(movieProgress.elapsed)} watched`
      : status === "Completed" ? "Finished" : "Not started";
    return (
      <div className="watchlist-progress">
        <strong>{movieProgress.percent === null ? detail : `${Math.round(movieProgress.percent)}%`}</strong>
        {movieProgress.percent !== null && <span>{detail}</span>}
        {movieProgress.percent !== null && (
          <div className="watchlist-progress-bar" role="progressbar" aria-label={`${item.title} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(movieProgress.percent)}>
            <span style={{ width: `${movieProgress.percent}%` }} />
          </div>
        )}
      </div>
    );
  };

  const renderActions = (item) => (
    <div className="watchlist-actions">
      <Link className="watchlist-open-action" to={getItemDetailPath(item)}>
        {getDisplayProgressStatus(item) === "Ongoing" ? <FaPlay aria-hidden="true" /> : <FaArrowUpRightFromSquare aria-hidden="true" />}
        {getDisplayProgressStatus(item) === "Ongoing" ? "Continue" : "Open"}
      </Link>
      <details
        className="watchlist-overflow"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            document.querySelectorAll(".watchlist-overflow[open]").forEach((menu) => {
              if (menu !== event.currentTarget) menu.removeAttribute("open");
            });
          }
        }}
      >
        <summary aria-label={`More actions for ${item.title}`}><FaEllipsis aria-hidden="true" /></summary>
        <div className="watchlist-overflow__menu">
          <button type="button" onClick={(event) => openPreview(item, event)}><FaPlay aria-hidden="true" /> Preview</button>
          <button type="button" onClick={(event) => openEdit(item, event)}><FaPen aria-hidden="true" /> Edit</button>
          <button type="button" className="danger" onClick={() => handleRemove(item)}><FaTrash aria-hidden="true" /> Remove</button>
        </div>
      </details>
    </div>
  );

  const getAriaSort = (key) =>
    sortConfig.key === key
      ? sortConfig.direction === "asc" ? "ascending" : "descending"
      : "none";

  if (!isLoggedIn) {
    return (
      <main className="watchlist-page watchlist-page--guest">
        <section className="watchlist-teaser">
          <div className="watchlist-teaser__beam" aria-hidden="true" />
          <p className="watchlist-page__eyebrow">Your Cineverse watchlist</p>
          <h1>Keep every title<br />close at hand.</h1>
          <p>Sign in to organize movies and series, keep your playback progress, and continue watching where you left off.</p>
          <div className="watchlist-teaser__grid" aria-label="Watchlist benefits">
            <article><strong>Track status</strong><span>Plan, watch, complete, or set a title aside.</span></article>
            <article><strong>Continue watching</strong><span>Pick up movies and episodes at your saved progress.</span></article>
            <article><strong>Keep your collection</strong><span>Move your watchlist with portable JSON backups.</span></article>
          </div>
          <p className="watchlist-teaser__hint">Use Login in the navigation to open your watchlist.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`watchlist-page density-${density}`}>
      <section
        className={`watchlist-hero${featureItem?.backdropPath ? " has-artwork" : ""}`}
        style={featureItem?.backdropPath ? { "--watchlist-backdrop": `url(${TMDB_ASSET_BASEURL}${featureItem.backdropPath})` } : undefined}
      >
        <div className="watchlist-hero__topline">
          <div>
            <p className="watchlist-page__eyebrow">Your collection · {new Date().getFullYear()}</p>
            <h1>Watchlist</h1>
          </div>
          <div className="watchlist-collection-controls" aria-label="Collection file controls">
            <span>Collection</span>
            <button type="button" onClick={() => fileInputRef.current?.click()}><FaFileArrowDown aria-hidden="true" /> Import</button>
            <button type="button" onClick={handleExport} disabled={!items.length}><FaFileArrowUp aria-hidden="true" /> Export</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport} />
          </div>
        </div>

        {featureItem ? (
          <div className="watchlist-feature">
            <div className="watchlist-feature__index" aria-hidden="true">{featureCanContinue ? <>CONTINUE<br />WATCHING</> : <>FROM YOUR<br />COLLECTION</>}</div>
            <div className="watchlist-feature__copy">
               <p className="watchlist-feature__kicker"><FaClockRotateLeft aria-hidden="true" /> {featureCanContinue ? "Continue watching" : "From your collection"}</p>
              <h2>{featureVideo?.metadata?.title || featureItem.title}</h2>
              <p className="watchlist-feature__context">
                 {featureItem.type === "tv" ? `Series · Season ${featureItem.currentSeason || 1}, episode ${featureItem.currentEpisode || 1}` : "Movie"}
                {featureVideo?.seconds ? ` · ${formatProgressTime(featureVideo.seconds)} watched` : ` · ${getDisplayProgressStatus(featureItem)}`}
              </p>
              {featureProgress !== null && (
                <div className="watchlist-feature__progress">
                  <div role="progressbar" aria-label={`${featureItem.title} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(featureProgress)}>
                    <span style={{ width: `${featureProgress}%` }} />
                  </div>
                  <span>{Math.round(featureProgress)}% complete</span>
                </div>
              )}
               <Link className="watchlist-feature__action" to={featurePath}><FaPlay aria-hidden="true" /> {featureCanContinue ? "Continue" : "Open title"} <FaArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        ) : (
          <div className="watchlist-feature watchlist-feature--empty">
            <div className="watchlist-feature__copy"><p className="watchlist-feature__kicker">Your watchlist</p><h2>Find your next favorite.</h2><p>Add movies and series to bring your current title into focus here.</p></div>
          </div>
        )}

        <div className="watchlist-rail" aria-label="Collection statistics and sync status">
          <dl>
            <div><dt>Total titles</dt><dd>{items.length}</dd></div>
            <div><dt>Movies complete</dt><dd>{dashboardStats.completedMovies}<small> / {dashboardStats.moviesTotal}</small></dd></div>
            <div><dt>Series complete</dt><dd>{dashboardStats.completedSeries}<small> / {dashboardStats.seriesTotal}</small></dd></div>
          </dl>
          <div className={`watchlist-sync-status ${syncStatus.state}`}>
            <span className="watchlist-sync-dot" aria-hidden="true" />
            <span>
              {syncStatus.state === "syncing"
                ? "Syncing collection..."
                : syncStatus.state === "error"
                  ? "Sync failed"
                  : syncStatus.syncedAt
                    ? `Last sync: ${formatSyncDateTime(syncStatus.syncedAt)}`
                    : "Not synced yet"}
            </span>
            <button type="button" onClick={handleManualSync} disabled={syncStatus.state === "syncing"} aria-label="Sync watchlist now" title="Sync now"><FaRotate aria-hidden="true" /></button>
            {syncStatus.state === "error" && syncStatus.error && <small>{syncStatus.error}</small>}
          </div>
        </div>
      </section>

      {message && <p className="watchlist-page__message" role="status">{message}</p>}

      {!items.length ? (
        <section className="watchlist-empty">
          <span className="watchlist-empty__mark" aria-hidden="true"><FaBoxArchive /></span>
          <p className="watchlist-page__eyebrow">Your collection is empty</p>
          <h2>Add your first title.</h2>
          <p>Add a movie or series from its detail page. Progress, release information, and your saved position will appear here.</p>
          <div><Link to="/movies">Browse movies <FaArrowRight aria-hidden="true" /></Link><Link to="/series">Browse series</Link></div>
        </section>
      ) : (
        <>
          <section className="watchlist-command" aria-label="Watchlist controls">
            <div className="watchlist-command__primary">
              <div className="watchlist-search-field">
                <FaMagnifyingGlass aria-hidden="true" />
                <label className="sr-only" htmlFor="watchlist-search">Search watchlist</label>
                <input id="watchlist-search" type="search" value={titleFilter} placeholder="Search your watchlist" onChange={(event) => setTitleFilter(event.target.value)} />
                {titleFilter && <button type="button" onClick={() => setTitleFilter("")} aria-label="Clear search"><FaXmark aria-hidden="true" /></button>}
              </div>
              <div className="watchlist-type-segments" role="group" aria-label="Filter by type">
                {[["all", "All titles"], ["movie", "Movies"], ["tv", "Series"]].map(([value, label]) => (
                  <button type="button" key={value} className={typeFilter === value ? "active" : ""} aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)}>{label}</button>
                ))}
              </div>
              <label className="watchlist-sort-select"><span>Order</span><select value={`${sortConfig.key}:${sortConfig.direction}`} onChange={(event) => { const [key, direction] = event.target.value.split(":"); setSortConfig({ key, direction }); }}><option value="progressStatus:asc">Ongoing first</option><option value="progressStatus:desc">Dropped first</option><option value="title:asc">Title A–Z</option><option value="title:desc">Title Z–A</option><option value="progress:desc">Most progress</option><option value="progress:asc">Least progress</option><option value="nextRelease:asc">Next release</option><option value="nextRelease:desc">Latest release</option><option value="customSort:asc">Custom organization</option><option value="updatedAt:desc">Recently updated</option></select><FaChevronDown aria-hidden="true" /></label>
            </div>
            <div className="watchlist-command__secondary">
              <div className="watchlist-status-chips" role="group" aria-label="Filter by watch status">
                {["all", ...WATCH_STATUS_OPTIONS].map((value) => <button type="button" key={value} className={statusFilter === value ? "active" : ""} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{value === "all" ? "Any status" : value}</button>)}
              </div>
              <div className="watchlist-command__summary">
                <span className="watchlist-filter-count" aria-live="polite">{visibleItems.length} {visibleItems.length === 1 ? "title" : "titles"}{hasActiveFilters ? " found" : " total"}</span>
                <button className="watchlist-reset" type="button" onClick={() => { setTitleFilter(""); setTypeFilter("all"); setStatusFilter("all"); }} disabled={!hasActiveFilters}>Reset filters</button>
                <div className="watchlist-density" role="group" aria-label="List density">
                  <button type="button" className={density === "comfortable" ? "active" : ""} aria-pressed={density === "comfortable"} onClick={() => setDensity("comfortable")} title="Comfortable density"><FaBarsStaggered aria-hidden="true" /><span>Comfortable</span></button>
                  <button type="button" className={density === "compact" ? "active" : ""} aria-pressed={density === "compact"} onClick={() => setDensity("compact")} title="Compact density"><FaBarsStaggered aria-hidden="true" /><span>Compact</span></button>
                </div>
              </div>
            </div>
          </section>

          <section className="watchlist-list" aria-label="Watchlist titles">
            <table className="watchlist-table">
              <thead><tr><th aria-sort={getAriaSort("title")}>{sortLabel("Title", "title")}</th><th aria-sort={getAriaSort("progress")}>{sortLabel("Progress", "progress")}</th><th aria-sort={getAriaSort("progressStatus")}>{sortLabel("Status", "progressStatus")}</th><th aria-sort={getAriaSort("nextRelease")}>{sortLabel("Next / release", "nextRelease")}</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const status = getDisplayProgressStatus(item);
                  const posterUrl = item.posterPath ? `${TMDB_ASSET_BASEURL}${item.posterPath}` : null;
                  return (
                    <tr key={item.id} className={`is-${getStatusClassName(status)}`}>
                       <td><div className="watchlist-title-cell"><img src={posterUrl || NoImagePlaceholder} alt="" onError={usePlaceholderOnError} /><div><span className="watchlist-row-index" aria-hidden="true">{String(items.indexOf(item) + 1).padStart(2, "0")}</span><Link to={getItemDetailPath(item)}>{item.title}</Link><span>{getCategoryLabel(item)} · {formatStoredDate(item.releaseDate)}{item.customSort ? ` · ${item.customSort}` : ""}</span></div></div></td>
                      <td>
                        {item.type === "tv" ? (
                          <button
                            type="button"
                            className="watchlist-progress-shortcut"
                            onClick={(event) => openEdit(item, event, "progress")}
                            aria-label={`Edit season and episode progress for ${item.title}`}
                            title="Edit season and episode"
                          >
                            {renderProgress(item)}
                            <span className="watchlist-progress-shortcut__hint"><FaPen aria-hidden="true" /> Edit</span>
                          </button>
                        ) : renderProgress(item)}
                      </td>
                      <td><span className={`watchlist-title-status-pill ${getStatusClassName(status)}`}><i aria-hidden="true" />{status}</span></td>
                      <td><strong className="watchlist-date">{formatRelativeDate(item.type === "tv" ? item.nextEpisodeDate : item.releaseDate, item.type)}</strong><span className="watchlist-release-status">{item.tmdbStatus || (item.type === "tv" ? "Schedule unavailable" : "Release status")}</span></td>
                      <td>{renderActions(item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibleItems.length && <div className="watchlist-table-empty"><FaMagnifyingGlass aria-hidden="true" /><h2>No titles match.</h2><p>Try another search or clear the active filters to see your full watchlist.</p><button type="button" onClick={() => { setTitleFilter(""); setTypeFilter("all"); setStatusFilter("all"); }}>Show full watchlist</button></div>}
            {visibleItems.length > 0 && <footer className="watchlist-table-footer"><span aria-live="polite">Showing {paginatedItems.length} of {visibleItems.length}</span>{visibleCount < visibleItems.length && <button type="button" onClick={() => setVisibleCount((count) => count + WATCHLIST_BATCH_SIZE)}>Load {Math.min(WATCHLIST_BATCH_SIZE, visibleItems.length - visibleCount)} more <span>· {visibleItems.length - visibleCount} remaining</span></button>}</footer>}
          </section>
        </>
      )}

      {panel && activeItem && (
        <div className="watchlist-panel-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
          <aside ref={panelRef} className="watchlist-panel" role="dialog" aria-modal="true" aria-labelledby="watchlist-panel-title">
            <header className="watchlist-panel__artwork">
               <img src={activeItem.backdropPath ? `${TMDB_ASSET_BASEURL}${activeItem.backdropPath}` : activeItem.posterPath ? `${TMDB_ASSET_BASEURL}${activeItem.posterPath}` : NoImagePlaceholder} alt="" onError={usePlaceholderOnError} />
               <div><span>{panel.type === "edit" ? "Edit watchlist title" : "Title preview"}</span><h2 id="watchlist-panel-title">{activeItem.title}</h2><p>{getCategoryLabel(activeItem)} · {formatStoredDate(activeItem.releaseDate)}</p></div>
              <button ref={closeButtonRef} type="button" className="watchlist-panel-close" onClick={closePanel} aria-label={`Close ${panel.type} panel`}><FaXmark aria-hidden="true" /></button>
            </header>
            {panel.type === "edit" && editDraft ? (
              <form className="watchlist-edit-form" onSubmit={(event) => { event.preventDefault(); saveEdit(); }}>
                <p className="watchlist-edit-note">Nothing changes until you save this draft.</p>
                 <fieldset className="watchlist-status-fieldset"><legend>Watch status</legend><div>{WATCH_STATUS_OPTIONS.map((option) => <label key={option} className={getStatusClassName(option)}><input type="radio" name="watch-status" value={option} checked={editDraft.progressStatus === option} onChange={(event) => setEditDraft((draft) => ({ ...draft, progressStatus: event.target.value }))} /><span><i aria-hidden="true" />{option}</span></label>)}</div></fieldset>
                 {activeItem.type === "tv" && <section className="watchlist-edit-section"><div className="watchlist-edit-section__heading"><span>Playback position</span><small>{activeItem.totalSeasons ? `${activeItem.totalSeasons} seasons` : "Series"}</small></div><div className="watchlist-edit-progress"><label><span>Season</span><input ref={progressInputRef} type="number" min="1" max={activeItem.totalSeasons || undefined} value={editDraft.currentSeason} onChange={(event) => setEditDraft((draft) => ({ ...draft, currentSeason: event.target.value }))} /></label><span aria-hidden="true">/</span><label><span>Episode</span><input type="number" min="1" max={Math.max(0, seasonEpisodeCounts[`${activeItem.id}:${editDraft.currentSeason}`]) || undefined} value={editDraft.currentEpisode} onChange={(event) => setEditDraft((draft) => ({ ...draft, currentEpisode: event.target.value }))} /></label></div><div className="watchlist-panel-progress">{renderProgress({ ...activeItem, ...editDraft })}</div></section>}
                <section className="watchlist-edit-section"><div className="watchlist-edit-section__heading"><span>Organization</span><small>Optional</small></div><label className="watchlist-custom-sort"><span>Custom sort label</span><input type="text" value={editDraft.customSort} placeholder="e.g. Awards season, Marvel, Sunday" onChange={(event) => setEditDraft((draft) => ({ ...draft, customSort: event.target.value }))} /><small>Groups this title when Custom organization is selected.</small></label></section>
                 <div className="watchlist-panel-actions"><button type="button" onClick={closePanel}>Discard changes</button><button type="submit" className="primary">Save changes</button></div>
              </form>
            ) : (
              <div className="watchlist-preview">
                <div className="watchlist-preview-media">
                  {previewPlaying && activePreview?.trailerKey ? <iframe src={`https://www.youtube.com/embed/${activePreview.trailerKey}?autoplay=1&rel=0&playsinline=1`} title={`${activeItem.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <img src={activePreview?.backdropPath ? `${TMDB_ASSET_BASEURL}${activePreview.backdropPath}` : activeItem.posterPath ? `${TMDB_ASSET_BASEURL}${activeItem.posterPath}` : NoImagePlaceholder} alt="" onError={usePlaceholderOnError} />}
                  {activePreview?.isLoading && <span className="watchlist-preview-loading">Preparing preview…</span>}
                  {!previewPlaying && activePreview?.trailerKey && <button type="button" className="watchlist-play-button" onClick={() => setPreviewPlaying(true)}><FaPlay aria-hidden="true" /> Play trailer</button>}
                </div>
                <p>{activePreview?.isLoading ? "Loading details..." : activePreview?.overview || "No description available yet."}</p>
                 <div className="watchlist-preview-meta"><div><span>Watch status</span><strong><i className={getStatusClassName(getDisplayProgressStatus(activeItem))} aria-hidden="true" />{getDisplayProgressStatus(activeItem)}</strong></div><div><span>Release status</span><strong>{activeItem.tmdbStatus || "Unknown"}</strong></div><div><span>Next / release</span><strong>{formatRelativeDate(activeItem.type === "tv" ? activeItem.nextEpisodeDate : activeItem.releaseDate, activeItem.type)}</strong></div></div>
                <section className="watchlist-preview-progress"><span>Saved position</span>{renderProgress(activeItem)}</section>
                <div className="watchlist-panel-actions"><button type="button" onClick={closePanel}>Close</button><Link className="primary" to={getItemDetailPath(activeItem)}>{getDisplayProgressStatus(activeItem) === "Ongoing" ? "Continue title" : "Open title"} <FaArrowUpRightFromSquare aria-hidden="true" /></Link></div>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
};

export default WatchlistPage;
