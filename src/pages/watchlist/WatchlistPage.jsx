import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  WATCH_STATUS_OPTIONS,
  getWatchlist,
  mergeWatchlist,
  removeFromWatchlist,
  syncWatchlistItemMetadata,
  updateWatchlistItem,
} from "../../utils/WatchlistStorage";
import { getVideoProgressEntries } from "../../utils/VideoProgressStorage";
import { formatDate } from "../../utils/DateUtils";
import instance from "../../service/tmdb/tmdb";
import { getSeriesSeasons, getSeriesTrailers, getShowDetails } from "../../service/tmdb/requests";
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
      Math.max(0, ((watchedEpisodesBeforeSeason + currentEpisode) / totalEpisodes) * 100)
    );
  }

  const totalSeasons = Number(item.totalSeasons);

  if (Number.isFinite(totalSeasons) && totalSeasons > 0) {
    return Math.min(100, Math.max(0, (currentSeason / totalSeasons) * 100));
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

const WatchlistPage = () => {
  const [items, setItems] = useState(() => getWatchlist());
  const [message, setMessage] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [titleFilter, setTitleFilter] = useState("");
  const [openHeaderMenu, setOpenHeaderMenu] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "progressStatus", direction: "asc" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [previewCache, setPreviewCache] = useState({});
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const [previewSide, setPreviewSide] = useState("right");
  const [previewMuted, setPreviewMuted] = useState(false);
  const [seasonEpisodeCounts, setSeasonEpisodeCounts] = useState({});
  const [videoProgressVersion, setVideoProgressVersion] = useState(0);
  const fileInputRef = useRef(null);
  const previewCloseTimeoutRef = useRef(null);

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
        result = (a.customSort || a.franchise || "zzz").localeCompare(
          b.customSort || b.franchise || "zzz"
        );
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

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedItems = visibleItems.slice(pageStartIndex, pageStartIndex + rowsPerPage);
  const hoveredItem = useMemo(() => {
    return paginatedItems.find((item) => item.id === hoveredItemId);
  }, [hoveredItemId, paginatedItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, statusFilter, titleFilter, typeFilter]);

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
    const canOpenRight = event.clientX + cardWidth + 18 < window.innerWidth;
    const left = canOpenRight
      ? event.clientX + 16
      : Math.max(12, event.clientX - cardWidth - 16);
    const top = Math.min(
      Math.max(12, event.clientY - 72),
      Math.max(12, window.innerHeight - cardHeight - 12)
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
                  <th>Actions</th>
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
                          onMouseMove={(event) => handleRowPreviewOpen(item, event)}
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
                                  <svg aria-hidden="true" viewBox="0 0 24 24">
                                    <path d="M4 9h4l5-4v14l-5-4H4V9z" />
                                    <path d="M17 9l4 4m0-4l-4 4" />
                                  </svg>
                                ) : (
                                  <svg aria-hidden="true" viewBox="0 0 24 24">
                                    <path d="M4 9h4l5-4v14l-5-4H4V9z" />
                                    <path d="M16 8c1.5 1.2 1.5 6.8 0 8" />
                                    <path d="M19 5c3 3.2 3 10.8 0 14" />
                                  </svg>
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
                          value={item.customSort || item.franchise || ""}
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
                                S{item.currentSeason || 1}
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
                                ? `Season ${item.currentSeason || 1} of ${item.totalSeasons}`
                                : `Season ${item.currentSeason || 1}`}
                              {seasonEpisodeCount
                                ? ` · Episode ${item.currentEpisode || 1} of ${seasonEpisodeCount}`
                                : ` · Episode ${item.currentEpisode || 1}`}
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
                      <td>
                        <div className="watchlist-actions">
                          <Link
                            className="watchlist-icon-action"
                            to={getItemDetailPath(item)}
                            aria-label={`Open ${item.title}`}
                            title="Open"
                          >
                            <span aria-hidden="true">↗</span>
                          </Link>
                          <button
                            type="button"
                            className="watchlist-icon-action danger"
                            onClick={() => handleRemove(item)}
                            aria-label={`Remove ${item.title}`}
                            title="Remove"
                          >
                            <span aria-hidden="true">×</span>
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
                Showing {visibleItems.length ? pageStartIndex + 1 : 0}-
                {Math.min(pageStartIndex + rowsPerPage, visibleItems.length)} of {visibleItems.length}
              </span>

              <div className="watchlist-pagination-controls">
                <label>
                  Rows
                  <select
                    value={rowsPerPage}
                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  >
                    {[5, 10, 20, 50].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                >
                  Prev
                </button>
                <strong>
                  {safeCurrentPage} / {totalPages}
                </strong>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default WatchlistPage;
