import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowUpRightFromSquare,
  FaTrash,
  FaRotate,
  FaVolumeHigh,
  FaVolumeXmark,
} from "react-icons/fa6";
import {
  WATCH_STATUS_OPTIONS,
  getWatchlist,
  mergeWatchlist,
  removeFromWatchlist,
  syncWatchlistItemMetadata,
  updateWatchlistItem,
} from "../../service/watchlist/watchlistStorage";
import { getVideoProgressEntries } from "../../service/videoProgress/videoProgressStorage";
import { formatDate } from "../../utils/DateUtils";
import instance from "../../service/tmdb/tmdb";
import { getSeriesSeasons, getSeriesTrailers, getShowDetails } from "../../service/tmdb/requests";
import { useAuth } from "../../context/AuthContext";
import { getStoredWatchlistSyncStatus, syncWatchlistForUser } from "../../service/watchlist/watchlistSync";
import { syncVideoProgressForUser } from "../../service/videoProgress/videoProgressSync";
import "./WatchlistPage.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const formatStoredDate = (date) => {
  if (!date) {
    return "-";
  }

  try {
    const formattedDate = formatDate(date);
    return formattedDate || "-";
  } catch {
    return "-";
  }
};

const formatProgressTime = (seconds) => {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0:00";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const getCategoryLabel = (item) => (item.type === "tv" ? "Series" : "Movie");

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

const getProgressPercent = (item, seasonEpisodeCounts = {}) => {
  const progressStatus = getDisplayProgressStatus(item);

  if (progressStatus === "Completed") {
    return 100;
  }

  if (item.type !== "tv") {
    return progressStatus === "Ongoing" ? 50 : 0;
  }

  const totalEpisodes = Number(item.totalEpisodes);
  const currentSeason = Number(item.currentSeason || 1);
  const currentEpisode = Number(item.currentEpisode || 1);

  if (Number.isFinite(totalEpisodes) && totalEpisodes > 0) {
    let watchedEpisodesBeforeSeason = 0;

    for (let season = 1; season < currentSeason; season += 1) {
      const episodeCount = seasonEpisodeCounts[`${item.id}:${season}`];

      if (!episodeCount || episodeCount < 0) {
        return progressStatus === "Ongoing" ? 35 : 0;
      }

      watchedEpisodesBeforeSeason += episodeCount;
    }

    return Math.min(
      100,
      Math.max(0, ((watchedEpisodesBeforeSeason + currentEpisode - 1) / totalEpisodes) * 100)
    );
  }

  const totalSeasons = Number(item.totalSeasons);

  if (Number.isFinite(totalSeasons) && totalSeasons > 0) {
    return Math.min(100, Math.max(0, ((currentSeason - 1) / totalSeasons) * 100));
  }

  return progressStatus === "Ongoing" ? 35 : 0;
};

const getDisplayProgressStatus = (item) => {
  if (item.progressStatus === "Watching") {
    return "Ongoing";
  }

  return item.progressStatus || "Planned";
};

const getStatusClassName = (status = "Planned") => {
  return status.toLowerCase().replace(/\s+/g, "-");
};

const STATUS_SORT_ORDER = {
  Ongoing: 0,
  Planned: 1,
  Completed: 2,
  Dropped: 3,
};

const WATCHLIST_BATCH_SIZE = 20;

const getItemDetailPath = (item) => {
  if (!item?.detailPath) {
    return "/";
  }

  if (item.type !== "tv") {
    return item.detailPath;
  }

  const params = new URLSearchParams();
  if (item.currentSeason) {
    params.set("season", item.currentSeason);
  }
  if (item.currentEpisode) {
    params.set("episode", item.currentEpisode);
  }

  const query = params.toString();
  return query ? `${item.detailPath}?${query}` : item.detailPath;
};

const formatSyncDateTime = (date) => {
  if (!date) {
    return "Not synced yet";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return "Sync time unavailable";
  }
};

const WatchlistPage = () => {
  const { isLoggedIn, user } = useAuth();
  const [items, setItems] = useState(() => getWatchlist());
  const [message, setMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState({ state: "idle", syncedAt: null, error: "" });
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [titleFilter, setTitleFilter] = useState("");
  const [openHeaderMenu, setOpenHeaderMenu] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "progressStatus", direction: "asc" });
  const [visibleCount, setVisibleCount] = useState(WATCHLIST_BATCH_SIZE);
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [previewCache, setPreviewCache] = useState({});
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const [previewSide, setPreviewSide] = useState("right");
  const [previewMuted, setPreviewMuted] = useState(false);
  const [seasonEpisodeCounts, setSeasonEpisodeCounts] = useState({});
  const [videoProgressVersion, setVideoProgressVersion] = useState(0);
  const fileInputRef = useRef(null);
  const previewCloseTimeoutRef = useRef(null);
  const infiniteScrollRef = useRef(null);

  const dashboardStats = useMemo(() => {
    const movies = items.filter((item) => item.type === "movie");
    const series = items.filter((item) => item.type === "tv");
    const completedMovies = movies.filter(
      (item) => item.progressStatus === "Completed"
    ).length;
    const completedSeries = series.filter(
      (item) => item.progressStatus === "Completed"
    ).length;
    const lastVideoWatched = getVideoProgressEntries()
      .filter((entry) => entry.metadata?.title)
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0) -
          new Date(a.updatedAt || 0)
      )[0];

    return {
      moviesTotal: movies.length,
      seriesTotal: series.length,
      completedMovies,
      completedSeries,
      moviePercent: movies.length ? (completedMovies / movies.length) * 100 : 0,
      seriesPercent: series.length ? (completedSeries / series.length) * 100 : 0,
      lastVideoWatched,
    };
  }, [items, videoProgressVersion]);

  const visibleItems = useMemo(() => {
    const normalizedTitleFilter = titleFilter.trim().toLowerCase();

    const filteredItems = items.filter((item) => {
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || getDisplayProgressStatus(item) === statusFilter;
      const matchesTitle =
        !normalizedTitleFilter || item.title.toLowerCase().includes(normalizedTitleFilter);

      return matchesType && matchesStatus && matchesTitle;
    });

    return [...filteredItems].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      let result = 0;

      if (sortConfig.key === "title") {
        result = a.title.localeCompare(b.title);
      } else if (sortConfig.key === "category") {
        result = getCategoryLabel(a).localeCompare(getCategoryLabel(b));
      } else if (sortConfig.key === "customSort") {
        result = (a.customSort || "zzz").localeCompare(b.customSort || "zzz");
      } else if (sortConfig.key === "progressStatus") {
        result =
          (STATUS_SORT_ORDER[getDisplayProgressStatus(a)] ?? 99) -
          (STATUS_SORT_ORDER[getDisplayProgressStatus(b)] ?? 99);
      } else if (sortConfig.key === "progress") {
        result =
          getProgressPercent(a, seasonEpisodeCounts) -
          getProgressPercent(b, seasonEpisodeCounts);
      } else if (sortConfig.key === "tmdbStatus") {
        result = (a.tmdbStatus || "zzz").localeCompare(b.tmdbStatus || "zzz");
      } else if (sortConfig.key === "nextEpisodeDate") {
        const aDate = a.nextEpisodeDate ? new Date(a.nextEpisodeDate).getTime() : Infinity;
        const bDate = b.nextEpisodeDate ? new Date(b.nextEpisodeDate).getTime() : Infinity;
        result = aDate - bDate;
      } else {
        result =
          new Date(a.updatedAt || a.addedAt || 0) -
          new Date(b.updatedAt || b.addedAt || 0);
      }

      if (result === 0) {
        result = a.title.localeCompare(b.title);
      }

      return result * direction;
    });
  }, [items, seasonEpisodeCounts, sortConfig, statusFilter, titleFilter, typeFilter]);

  const paginatedItems = visibleItems.slice(0, visibleCount);
  const hoveredItem = useMemo(() => {
    return visibleItems.find((item) => item.id === hoveredItemId);
  }, [hoveredItemId, visibleItems]);

  useEffect(() => {
    setVisibleCount(WATCHLIST_BATCH_SIZE);
  }, [sortConfig, statusFilter, titleFilter, typeFilter]);

  useEffect(() => {
    const sentinel = infiniteScrollRef.current;
    if (!sentinel || visibleCount >= visibleItems.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + WATCHLIST_BATCH_SIZE, visibleItems.length));
        }
      },
      { rootMargin: "240px" }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [visibleCount, visibleItems.length]);

  useEffect(() => {
    setItems(getWatchlist());
    setSyncStatus(getStoredWatchlistSyncStatus(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const handleWatchlistSync = (event) => {
      setItems(event.detail?.items || getWatchlist());
    };

    const handleWatchlistSyncStatus = (event) => {
      if (event.detail?.userID && event.detail.userID !== user?.id) {
        return;
      }

      setSyncStatus((currentStatus) => ({
        ...currentStatus,
        ...event.detail,
      }));
    };

    window.addEventListener("cineverse-watchlist-sync", handleWatchlistSync);
    window.addEventListener("cineverse-watchlist-sync-status", handleWatchlistSyncStatus);

    return () => {
      window.removeEventListener("cineverse-watchlist-sync", handleWatchlistSync);
      window.removeEventListener("cineverse-watchlist-sync-status", handleWatchlistSyncStatus);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleVideoProgress = () => {
      setVideoProgressVersion((version) => version + 1);
    };

    window.addEventListener("cineverse-video-progress", handleVideoProgress);
    window.addEventListener("storage", handleVideoProgress);

    return () => {
      window.removeEventListener("cineverse-video-progress", handleVideoProgress);
      window.removeEventListener("storage", handleVideoProgress);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewCloseTimeoutRef.current) {
        window.clearTimeout(previewCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    paginatedItems.forEach((item) => {
      if (item.type !== "tv") {
        return;
      }

      const currentSeason = Number(item.currentSeason || 1);

      for (let season = 1; season <= currentSeason; season += 1) {
        const cacheKey = `${item.id}:${season}`;
        if (!seasonEpisodeCounts[cacheKey]) {
          getSeasonEpisodeCount(item, season);
        }
      }
    });
  }, [paginatedItems, seasonEpisodeCounts]);

  useEffect(() => {
    if (!hoveredItem || previewCache[hoveredItem.id]) {
      return;
    }

    let isActive = true;

    const fetchPreview = async () => {
      setPreviewCache((currentCache) => ({
        ...currentCache,
        [hoveredItem.id]: { isLoading: true },
      }));

      try {
        const [detailsResponse, trailerResponse] = await Promise.all([
          instance.get(getShowDetails(hoveredItem.type, hoveredItem.tmdbID)),
          instance.get(getSeriesTrailers(hoveredItem.type, hoveredItem.tmdbID)),
        ]);

        if (!isActive) {
          return;
        }

        const trailer = selectBestTrailer(trailerResponse.data?.results);
        const syncedItems = syncWatchlistItemMetadata(hoveredItem.id, {
          tmdbStatus: detailsResponse.data?.status || null,
          totalSeasons: detailsResponse.data?.number_of_seasons || hoveredItem.totalSeasons,
          totalEpisodes: detailsResponse.data?.number_of_episodes || hoveredItem.totalEpisodes,
          nextEpisodeDate: detailsResponse.data?.next_episode_to_air?.air_date || null,
        });

        setItems(syncedItems);

        setPreviewCache((currentCache) => ({
          ...currentCache,
          [hoveredItem.id]: {
            isLoading: false,
            overview: detailsResponse.data?.overview || "No description available yet.",
            trailerKey: trailer?.key || null,
            backdropPath: detailsResponse.data?.backdrop_path || hoveredItem.backdropPath,
          },
        }));
      } catch {
        if (!isActive) {
          return;
        }

        setPreviewCache((currentCache) => ({
          ...currentCache,
          [hoveredItem.id]: {
            isLoading: false,
            overview: "Preview unavailable right now.",
            trailerKey: null,
            backdropPath: hoveredItem.backdropPath,
          },
        }));
      }
    };

    fetchPreview();

    return () => {
      isActive = false;
    };
  }, [hoveredItem, previewCache]);

  const handleSort = (key) => {
    setSortConfig((currentSort) => ({
      key,
      direction:
        currentSort.key === key && currentSort.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return "↕";
    }

    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const renderSortButton = (label, key) => (
    <button
      type="button"
      className="watchlist-header-button"
      onClick={() => handleSort(key)}
      aria-label={`Sort by ${label}`}
    >
      <span aria-hidden="true">{renderSortIcon(key)}</span>
    </button>
  );

  const renderHeaderControls = (label, sortKey, menuKey) => (
    <div className="watchlist-header-controls">
      <button
        type="button"
        className="watchlist-header-menu-button"
        onClick={() => setOpenHeaderMenu(openHeaderMenu === menuKey ? null : menuKey)}
      >
        {label}
      </button>
      {renderSortButton(label, sortKey)}
    </div>
  );

  const renderSortableHeader = (label, sortKey) => (
    <div className="watchlist-header-controls">
      <span className="watchlist-header-label">{label}</span>
      {renderSortButton(label, sortKey)}
    </div>
  );

  const refreshItems = (nextItems) => {
    setItems(nextItems);
  };

  const handleUpdate = async (item, updates) => {
    const nextUpdates = { ...updates };

    if (item.type === "tv" && updates.progressStatus === "Completed") {
      const finalSeason = item.totalSeasons || item.currentSeason || 1;
      const finalSeasonEpisodeCount = await getSeasonEpisodeCount(item, finalSeason);

      nextUpdates.currentSeason = finalSeason;
      nextUpdates.currentEpisode = finalSeasonEpisodeCount || item.currentEpisode || 1;
    }

    refreshItems(updateWatchlistItem(item.id, nextUpdates));
  };

  const getSeasonEpisodeCount = async (item, season) => {
    const cacheKey = `${item.id}:${season}`;
    if (seasonEpisodeCounts[cacheKey] !== undefined) {
      return Math.max(0, seasonEpisodeCounts[cacheKey]);
    }

    try {
      const response = await instance.get(getSeriesSeasons(item.tmdbID, season));
      const episodeCount = response.data?.episodes?.length || 0;

      setSeasonEpisodeCounts((currentCounts) => ({
        ...currentCounts,
        [cacheKey]: episodeCount || -1,
      }));

      return episodeCount;
    } catch {
      setSeasonEpisodeCounts((currentCounts) => ({
        ...currentCounts,
        [cacheKey]: -1,
      }));
      return 0;
    }
  };

  const handleSeasonChange = async (item, nextSeason) => {
    const normalizedSeason = Math.max(1, Number(nextSeason) || 1);
    const totalSeasons = Number(item.totalSeasons || 0);
    const seasonEpisodeCount = await getSeasonEpisodeCount(item, normalizedSeason);
    const shouldCompleteSeries =
      totalSeasons > 0 &&
      seasonEpisodeCount === 1 &&
      normalizedSeason === totalSeasons;

    handleUpdate(item, {
      currentSeason: normalizedSeason,
      currentEpisode: 1,
      ...(shouldCompleteSeries ? { progressStatus: "Completed" } : {}),
      ...(!shouldCompleteSeries && getDisplayProgressStatus(item) === "Planned"
        ? { progressStatus: "Ongoing" }
        : {}),
      ...(!shouldCompleteSeries && getDisplayProgressStatus(item) === "Completed"
        ? { progressStatus: "Ongoing" }
        : {}),
    });
  };

  const handleEpisodeChange = async (item, nextEpisode) => {
    const parsedEpisode = Number(nextEpisode);
    const requestedEpisode = Number.isFinite(parsedEpisode) ? parsedEpisode : 1;
    const normalizedEpisode = Math.max(1, requestedEpisode);
    const currentSeason = Number(item.currentSeason || 1);
    const totalSeasons = Number(item.totalSeasons || 0);
    const currentSeasonEpisodeCount = await getSeasonEpisodeCount(item, currentSeason);

    if (requestedEpisode < 1 && currentSeason > 1) {
      const previousSeason = currentSeason - 1;
      const previousSeasonEpisodeCount = await getSeasonEpisodeCount(item, previousSeason);

      handleUpdate(item, {
        currentSeason: previousSeason,
        currentEpisode: previousSeasonEpisodeCount || 1,
        ...(getDisplayProgressStatus(item) === "Planned" ? { progressStatus: "Ongoing" } : {}),
        ...(getDisplayProgressStatus(item) === "Completed" ? { progressStatus: "Ongoing" } : {}),
      });
      return;
    }

    if (
      currentSeasonEpisodeCount > 0 &&
      normalizedEpisode > currentSeasonEpisodeCount &&
      (!totalSeasons || currentSeason < totalSeasons)
    ) {
      handleUpdate(item, {
        currentSeason: currentSeason + 1,
        currentEpisode: 1,
        ...(getDisplayProgressStatus(item) === "Planned" ? { progressStatus: "Ongoing" } : {}),
        ...(getDisplayProgressStatus(item) === "Completed" ? { progressStatus: "Ongoing" } : {}),
      });
      return;
    }

    if (currentSeasonEpisodeCount > 0 && normalizedEpisode > currentSeasonEpisodeCount) {
      const shouldCompleteSeries = totalSeasons > 0 && currentSeason === totalSeasons;

      handleUpdate(item, {
        currentEpisode: currentSeasonEpisodeCount,
        ...(shouldCompleteSeries ? { progressStatus: "Completed" } : {}),
        ...(!shouldCompleteSeries && getDisplayProgressStatus(item) === "Planned"
          ? { progressStatus: "Ongoing" }
          : {}),
      });
      return;
    }

    const shouldCompleteSeries =
      totalSeasons > 0 &&
      currentSeasonEpisodeCount > 0 &&
      currentSeason === totalSeasons &&
      normalizedEpisode >= currentSeasonEpisodeCount;

    handleUpdate(item, {
      currentEpisode: normalizedEpisode,
      ...(shouldCompleteSeries ? { progressStatus: "Completed" } : {}),
      ...(!shouldCompleteSeries && getDisplayProgressStatus(item) === "Planned"
        ? { progressStatus: "Ongoing" }
        : {}),
      ...(!shouldCompleteSeries && getDisplayProgressStatus(item) === "Completed"
        ? { progressStatus: "Ongoing" }
        : {}),
    });
  };

  const handleRowPreviewOpen = (item, event) => {
    if (previewCloseTimeoutRef.current) {
      window.clearTimeout(previewCloseTimeoutRef.current);
    }

    const cardWidth = Math.min(448, window.innerWidth * 0.72);
    const cardHeight = 430;
    const margin = 12;
    const canOpenRight = event.clientX + cardWidth - 24 < window.innerWidth - margin;
    const left = canOpenRight
      ? Math.min(event.clientX - 24, window.innerWidth - cardWidth - margin)
      : Math.max(margin, event.clientX - cardWidth + 24);
    const top = Math.max(
      margin,
      Math.min(event.clientY - 72, window.innerHeight - cardHeight - margin)
    );

    setPreviewPosition({ top, left });
    setPreviewSide(canOpenRight ? "right" : "left");
    setHoveredItemId(item.id);
  };

  const handlePreviewClose = () => {
    previewCloseTimeoutRef.current = window.setTimeout(() => {
      setHoveredItemId(null);
    }, 180);
  };

  const handleRemove = (item) => {
    const shouldRemove = window.confirm(
      `Remove "${item.title}" from your watchlist?`
    );

    if (!shouldRemove) {
      return;
    }

    const id = item.id;
    refreshItems(removeFromWatchlist(id));
    setMessage("Removed from watchlist.");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `cineverse-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Watchlist exported.");
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const importedItems = JSON.parse(await file.text());
      if (!Array.isArray(importedItems)) {
        throw new Error("Invalid watchlist format.");
      }

      refreshItems(mergeWatchlist(importedItems));
      setMessage("Watchlist imported and merged.");
    } catch {
      setMessage("Import failed. Please choose a valid watchlist JSON file.");
    } finally {
      event.target.value = "";
    }
  };

  const handleManualSync = async () => {
    if (!user?.id || syncStatus.state === "syncing") {
      return;
    }

    try {
      await Promise.all([
        syncWatchlistForUser(user.id),
        syncVideoProgressForUser(user.id),
      ]);
    } catch {
      return;
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="watchlist-page">
        <section className="watchlist-teaser">
          <p className="watchlist-page__eyebrow">Private watchlist</p>
          <h1>Build your Cineverse watch hub</h1>
          <p>
            Login to unlock your saved movies, series progress, continue-watching links,
            exports, imports, and status tracking in one dashboard.
          </p>
          <div className="watchlist-teaser__grid" aria-label="Watchlist benefits">
            <article>
              <strong>Track progress</strong>
              <span>See what is planned, ongoing, completed, or dropped.</span>
            </article>
            <article>
              <strong>Resume faster</strong>
              <span>Continue movies and episodes from your latest saved progress.</span>
            </article>
            <article>
              <strong>Keep control</strong>
              <span>Export and import your local watchlist whenever you need.</span>
            </article>
          </div>
          <p className="watchlist-teaser__hint">Use Login in the top navigation to access it.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="watchlist-page">
      <section className="watchlist-page__header">
        <div>
          <p className="watchlist-page__eyebrow">Local tracker</p>
          <h1>Watchlist</h1>
          <p>
            Track movies and series progress locally. Export your JSON backup when
            you want to save or move the data.
          </p>
        </div>

        <div className="watchlist-page__tools">
          <button type="button" onClick={handleExport} disabled={!items.length}>
            Export
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
          />
        </div>
      </section>

      {message && <p className="watchlist-page__message">{message}</p>}

      <div className={`watchlist-sync-status ${syncStatus.state}`}>
        <span>
          {syncStatus.state === "syncing"
            ? "Syncing watchlist..."
            : `Last sync: ${formatSyncDateTime(syncStatus.syncedAt)}`}
        </span>
        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncStatus.state === "syncing"}
          aria-label="Sync watchlist now"
          title="Sync now"
        >
          <FaRotate aria-hidden="true" />
        </button>
        {syncStatus.state === "error" && syncStatus.error && (
          <small>{syncStatus.error}</small>
        )}
      </div>

      <section className="watchlist-dashboard" aria-label="Watchlist dashboard">
        <article className="watchlist-stat-card">
          <span>Movies Watched</span>
          <strong>{dashboardStats.completedMovies}</strong>
          <p>{dashboardStats.moviesTotal} movies in watchlist</p>
          <div className="watchlist-stat-bar" aria-hidden="true">
            <span style={{ width: `${dashboardStats.moviePercent}%` }}></span>
          </div>
        </article>

        <article className="watchlist-stat-card">
          <span>Series Watched</span>
          <strong>{dashboardStats.completedSeries}</strong>
          <p>{dashboardStats.seriesTotal} series in watchlist</p>
          <div className="watchlist-stat-bar" aria-hidden="true">
            <span style={{ width: `${dashboardStats.seriesPercent}%` }}></span>
          </div>
        </article>

        <article className="watchlist-stat-card watchlist-stat-card--wide">
          <span>Last Video Watched</span>
          <strong>{dashboardStats.lastVideoWatched?.metadata?.title || "-"}</strong>
          <p>
            {dashboardStats.lastVideoWatched
              ? `${formatProgressTime(dashboardStats.lastVideoWatched.seconds)} watched · ${formatStoredDate(dashboardStats.lastVideoWatched.updatedAt)}`
              : "Open a movie or episode to show it here."}
          </p>
          {dashboardStats.lastVideoWatched?.metadata?.detailPath && (
            <Link
              className="watchlist-continue-link"
              to={dashboardStats.lastVideoWatched.metadata.detailPath}
            >
              Continue Watching
            </Link>
          )}
        </article>
      </section>

      {!items.length ? (
        <section className="watchlist-empty">
          <h2>No saved titles yet</h2>
          <p>Add movies or series from their detail page to start tracking.</p>
          <div>
            <Link to="/movies">Browse Movies</Link>
            <Link to="/series">Browse Series</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="watchlist-table-wrap">
            <table className="watchlist-table">
              <thead>
                <tr>
                  <th className="watchlist-filter-header title">
                    {renderHeaderControls("Title", "title", "title")}
                    {openHeaderMenu === "title" && (
                      <div className="watchlist-header-menu search">
                        <label>
                          Search title
                          <input
                            type="search"
                            value={titleFilter}
                            placeholder="Search watchlist"
                            onChange={(event) => setTitleFilter(event.target.value)}
                            autoFocus
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setTitleFilter("");
                            setOpenHeaderMenu(null);
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </th>
                  <th className="watchlist-filter-header">
                    {renderHeaderControls("Type", "category", "type")}
                    {openHeaderMenu === "type" && (
                      <div className="watchlist-header-menu">
                        {[
                          ["all", "All"],
                          ["movie", "Movies"],
                          ["tv", "Series"],
                        ].map(([value, label]) => (
                          <button
                            type="button"
                            key={value}
                            className={typeFilter === value ? "active" : ""}
                            onClick={() => {
                              setTypeFilter(value);
                              setOpenHeaderMenu(null);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </th>
                  <th>{renderSortableHeader("Custom Sort", "customSort")}</th>
                  <th className="watchlist-filter-header">
                    {renderHeaderControls("Status", "progressStatus", "status")}
                    {openHeaderMenu === "status" && (
                      <div className="watchlist-header-menu">
                        {["all", ...WATCH_STATUS_OPTIONS].map((value) => (
                          <button
                            type="button"
                            key={value}
                            className={statusFilter === value ? "active" : ""}
                            onClick={() => {
                              setStatusFilter(value);
                              setOpenHeaderMenu(null);
                            }}
                          >
                            {value === "all" ? "All" : value}
                          </button>
                        ))}
                      </div>
                    )}
                  </th>
                  <th>{renderSortableHeader("Progress", "progress")}</th>
                  <th>{renderSortableHeader("Release", "tmdbStatus")}</th>
                  <th>{renderSortableHeader("Next", "nextEpisodeDate")}</th>
                  <th>{renderSortableHeader("Updated", "updatedAt")}</th>
                  <th className="watchlist-actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const progressPercent = getProgressPercent(item, seasonEpisodeCounts);
                  const progressStatus = getDisplayProgressStatus(item);
                  const seasonEpisodeCount = seasonEpisodeCounts[
                    `${item.id}:${item.currentSeason || 1}`
                  ];
                  const previewData = previewCache[item.id];
                  const previewBackdropUrl = previewData?.backdropPath
                    ? `${TMDB_ASSET_BASEURL}${previewData.backdropPath}`
                    : null;
                  const trailerUrl = previewData?.trailerKey
                    ? `https://www.youtube.com/embed/${previewData.trailerKey}?autoplay=1&mute=${previewMuted ? "1" : "0"}&controls=0&loop=1&playlist=${previewData.trailerKey}&playsinline=1&rel=0&modestbranding=1&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
                    : null;
                  const posterUrl = item.posterPath
                    ? `${TMDB_ASSET_BASEURL}${item.posterPath}`
                    : null;

                  return (
                    <tr
                      key={item.id}
                      className={`is-${getStatusClassName(progressStatus)}`}
                    >
                      <td>
                        <div
                          className="watchlist-title-cell"
                          onMouseEnter={(event) => handleRowPreviewOpen(item, event)}
                          onMouseLeave={handlePreviewClose}
                        >
                          {posterUrl && <img src={posterUrl} alt={item.title} />}
                          <div>
                            <span className={`watchlist-title-status-pill ${getStatusClassName(progressStatus)}`}>
                              {progressStatus}
                            </span>
                            <Link to={getItemDetailPath(item)}>{item.title}</Link>
                            <span>{formatStoredDate(item.releaseDate)}</span>
                          </div>
                        </div>
                        {hoveredItemId === item.id && (
                          <aside
                            className={`watchlist-preview-card ${previewSide}`}
                            style={{ top: previewPosition.top, left: previewPosition.left }}
                            aria-label={`${item.title} preview`}
                            onMouseEnter={() => {
                              if (previewCloseTimeoutRef.current) {
                                window.clearTimeout(previewCloseTimeoutRef.current);
                              }
                            }}
                            onMouseLeave={handlePreviewClose}
                          >
                            <div className="watchlist-preview-media">
                              {trailerUrl ? (
                                <iframe
                                  src={trailerUrl}
                                  title={`${item.title} trailer preview`}
                                  allow="autoplay; encrypted-media; picture-in-picture"
                                  allowFullScreen
                                />
                              ) : previewBackdropUrl ? (
                                <img src={previewBackdropUrl} alt="" />
                              ) : (
                                <div className="watchlist-preview-placeholder">Preview loading</div>
                              )}
                              <button
                                type="button"
                                className="watchlist-preview-mute"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setPreviewMuted((isMuted) => !isMuted);
                                }}
                                aria-label={previewMuted ? "Unmute preview" : "Mute preview"}
                              >
                                {previewMuted ? (
                                  <FaVolumeXmark aria-hidden="true" />
                                ) : (
                                  <FaVolumeHigh aria-hidden="true" />
                                )}
                              </button>
                            </div>
                            <div className="watchlist-preview-copy">
                              <strong>{item.title}</strong>
                              <p>
                                {previewData?.isLoading
                                  ? "Loading preview..."
                                  : previewData?.overview || "Hover to load this title preview."}
                              </p>
                              <Link to={getItemDetailPath(item)}>Watch Now!</Link>
                            </div>
                          </aside>
                        )}
                      </td>
                      <td>
                        <span className={`watchlist-category-pill ${item.type}`}>
                          {getCategoryLabel(item)}
                        </span>
                      </td>
                      <td>
                        <input
                          className="watchlist-custom-sort-input"
                          type="text"
                          value={item.customSort || ""}
                          placeholder="e.g. Marvel"
                          onChange={(event) =>
                            handleUpdate(item, { customSort: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <select
                          className={`watchlist-status-select ${getStatusClassName(progressStatus)}`}
                          value={progressStatus}
                          onChange={(event) =>
                            handleUpdate(item, { progressStatus: event.target.value })
                          }
                        >
                          {WATCH_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {item.type === "tv" ? (
                          <div className="watchlist-progress-controls">
                            <div className="watchlist-progress-summary">
                              <strong>{Math.round(progressPercent)}%</strong>
                              <span>
                                Next S{item.currentSeason || 1}
                                {item.totalSeasons ? `/${item.totalSeasons}` : ""} · E{item.currentEpisode || 1}
                              </span>
                            </div>
                            <div className="watchlist-progress-bar">
                              <span style={{ width: `${progressPercent}%` }} />
                            </div>
                            <div className="watchlist-progress-fields">
                              <label>
                                S
                                <input
                                  type="number"
                                  min="1"
                                  max={item.totalSeasons || undefined}
                                  value={item.currentSeason || 1}
                                  onChange={(event) =>
                                    handleSeasonChange(item, event.target.value)
                                  }
                                />
                              </label>
                              <label>
                                E
                                <input
                                  type="number"
                                  value={item.currentEpisode || 1}
                                  onChange={(event) =>
                                    handleEpisodeChange(item, event.target.value)
                                  }
                                />
                              </label>
                            </div>
                            <span>
                              {item.totalSeasons
                                ? `Next season ${item.currentSeason || 1} of ${item.totalSeasons}`
                                : `Next season ${item.currentSeason || 1}`}
                              {seasonEpisodeCount
                                ? ` · episode ${item.currentEpisode || 1} of ${seasonEpisodeCount}`
                                : ` · episode ${item.currentEpisode || 1}`}
                            </span>
                          </div>
                        ) : (
                          <div className="watchlist-progress-controls compact">
                            <div className="watchlist-progress-summary">
                              <strong>{Math.round(progressPercent)}%</strong>
                              <span>{progressStatus}</span>
                            </div>
                            <div className="watchlist-progress-bar">
                              <span style={{ width: `${progressPercent}%` }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td>{item.tmdbStatus || "-"}</td>
                      <td>{item.type === "tv" ? formatStoredDate(item.nextEpisodeDate) : "-"}</td>
                      <td>{formatStoredDate(item.updatedAt)}</td>
                      <td className="watchlist-actions-column">
                        <div className="watchlist-actions">
                          <Link
                            className="watchlist-icon-action"
                            to={getItemDetailPath(item)}
                            aria-label={`Open ${item.title}`}
                            title="Open"
                          >
                            <FaArrowUpRightFromSquare aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            className="watchlist-icon-action danger"
                            onClick={() => handleRemove(item)}
                            aria-label={`Remove ${item.title}`}
                            title="Remove"
                          >
                            <FaTrash aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!visibleItems.length && (
              <p className="watchlist-table-empty">No titles match these filters.</p>
            )}

            <div className="watchlist-table-footer">
              <span>
                Showing {paginatedItems.length} of {visibleItems.length}
              </span>
            </div>
            <div ref={infiniteScrollRef} className="watchlist-infinite-sentinel" aria-hidden="true" />
          </section>
        </>
      )}
    </main>
  );
};

export default WatchlistPage;
