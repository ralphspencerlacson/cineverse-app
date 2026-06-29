import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  WATCH_STATUS_OPTIONS,
  getWatchlist,
  mergeWatchlist,
  removeFromWatchlist,
  updateWatchlistItem,
} from "../../utils/WatchlistStorage";
import { getVideoProgressEntries } from "../../utils/VideoProgressStorage";
import { formatDate } from "../../utils/DateUtils";
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [nextEpisodeFilter, setNextEpisodeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("customSort");
  const fileInputRef = useRef(null);

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
  }, [items]);

  const visibleItems = useMemo(() => {
    const filteredItems = items.filter((item) => {
      const matchesCategory = categoryFilter === "all" || item.type === categoryFilter;
      const hasNextEpisode = item.type === "tv" && Boolean(item.nextEpisodeDate);
      const isNotConcluded =
        item.type === "tv" &&
        item.tmdbStatus &&
        !["Ended", "Canceled", "Cancelled"].includes(item.tmdbStatus);

      const matchesNextEpisode =
        nextEpisodeFilter === "all" ||
        (nextEpisodeFilter === "upcoming" && hasNextEpisode) ||
        (nextEpisodeFilter === "notConcluded" && isNotConcluded);

      return matchesCategory && matchesNextEpisode;
    });

    return [...filteredItems].sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }

      if (sortBy === "nextEpisode") {
        const aDate = a.nextEpisodeDate ? new Date(a.nextEpisodeDate).getTime() : Infinity;
        const bDate = b.nextEpisodeDate ? new Date(b.nextEpisodeDate).getTime() : Infinity;
        return aDate - bDate;
      }

      if (sortBy === "customSort") {
        const customSort = (a.customSort || a.franchise || "zzz").localeCompare(
          b.customSort || b.franchise || "zzz"
        );

        if (customSort !== 0) {
          return customSort;
        }

        const aDate = a.releaseDate ? new Date(a.releaseDate).getTime() : Infinity;
        const bDate = b.releaseDate ? new Date(b.releaseDate).getTime() : Infinity;

        if (aDate !== bDate) {
          return aDate - bDate;
        }

        return a.title.localeCompare(b.title);
      }

      return (
        new Date(b.updatedAt || b.addedAt || 0) -
        new Date(a.updatedAt || a.addedAt || 0)
      );
    });
  }, [categoryFilter, items, nextEpisodeFilter, sortBy]);

  const refreshItems = (nextItems) => {
    setItems(nextItems);
  };

  const handleUpdate = (item, updates) => {
    const nextUpdates = { ...updates };

    if (item.type === "tv" && updates.progressStatus === "Completed") {
      nextUpdates.currentSeason = item.totalSeasons || item.currentSeason || 1;
      nextUpdates.currentEpisode = item.totalEpisodes || item.currentEpisode || 1;
    }

    refreshItems(updateWatchlistItem(item.id, nextUpdates));
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
          <section className="watchlist-controls" aria-label="Watchlist controls">
            <label>
              Category
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="movie">Movies</option>
                <option value="tv">Series</option>
              </select>
            </label>

            <label>
              Next Episode
              <select
                value={nextEpisodeFilter}
                onChange={(event) => setNextEpisodeFilter(event.target.value)}
              >
                <option value="all">All titles</option>
                <option value="upcoming">Has next episode</option>
                <option value="notConcluded">Series not concluded</option>
              </select>
            </label>

            <label>
              Sort
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="updated">Recently updated</option>
                <option value="title">Title A-Z</option>
                <option value="customSort">Custom Sort</option>
                <option value="nextEpisode">Next episode date</option>
              </select>
            </label>
          </section>

          <section className="watchlist-table-wrap">
            <table className="watchlist-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Custom Sort</th>
                  <th>Watch Status</th>
                  <th>Progress</th>
                  <th>Release Status</th>
                  <th>Next Episode</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                const posterUrl = item.posterPath
                  ? `${TMDB_ASSET_BASEURL}${item.posterPath}`
                  : null;

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="watchlist-title-cell">
                        {posterUrl && <img src={posterUrl} alt={item.title} />}
                        <div>
                          <Link to={getItemDetailPath(item)}>{item.title}</Link>
                          <span>{formatStoredDate(item.releaseDate)}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.type === "tv" ? "Series" : "Movie"}</td>
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
                        value={item.progressStatus || "Planned"}
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
                          <label>
                            Season
                            <input
                              type="number"
                              min="1"
                              max={item.totalSeasons || undefined}
                              value={item.currentSeason || 1}
                              onChange={(event) =>
                                handleUpdate(item, {
                                  currentSeason: Number(event.target.value) || 1,
                                })
                              }
                            />
                          </label>
                          <label>
                            Episode
                            <input
                              type="number"
                              min="1"
                              max={item.totalEpisodes || undefined}
                              value={item.currentEpisode || 1}
                              onChange={(event) =>
                                handleUpdate(item, {
                                  currentEpisode: Number(event.target.value) || 1,
                                })
                              }
                            />
                          </label>
                          <span>
                            {item.totalSeasons
                              ? `Season ${item.currentSeason || 1} of ${item.totalSeasons}`
                              : `Season ${item.currentSeason || 1}`}
                            {item.totalEpisodes
                              ? ` · Episode ${item.currentEpisode || 1} of ${item.totalEpisodes} total`
                              : ` · Episode ${item.currentEpisode || 1}`}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{item.tmdbStatus || "-"}</td>
                    <td>{item.type === "tv" ? formatStoredDate(item.nextEpisodeDate) : "-"}</td>
                    <td>{formatStoredDate(item.updatedAt)}</td>
                    <td>
                      <div className="watchlist-actions">
                        <Link to={getItemDetailPath(item)}>Open</Link>
                        <button type="button" onClick={() => handleRemove(item)}>
                          Remove
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
          </section>
        </>
      )}
    </main>
  );
};

export default WatchlistPage;
