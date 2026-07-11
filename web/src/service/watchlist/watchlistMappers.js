// Converts between local watchlist items and normalized Supabase rows.
const toNumberOrNull = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export const toWatchlistRow = (userID, item) => {
  if (!userID || !item) {
    return null;
  }

  return {
    user_id: userID,
    media_type: item.type,
    tmdb_id: toNumberOrNull(item.tmdbID),
    title: item.title,
    poster_path: item.posterPath || null,
    backdrop_path: item.backdropPath || null,
    release_date: item.releaseDate || null,
    tmdb_status: item.tmdbStatus || null,
    total_seasons: toNumberOrNull(item.totalSeasons),
    total_episodes: toNumberOrNull(item.totalEpisodes),
    next_episode_date: item.nextEpisodeDate || null,
    detail_path: item.detailPath || null,
    progress_status: item.progressStatus || "Planned",
    current_season: toNumberOrNull(item.currentSeason),
    current_episode: toNumberOrNull(item.currentEpisode),
    custom_sort: item.customSort || item.franchise || null,
    added_at: item.addedAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  };
};

export const fromWatchlistRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: `${row.media_type}:${row.tmdb_id}`,
    tmdbID: row.tmdb_id,
    type: row.media_type,
    title: row.title,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    releaseDate: row.release_date,
    tmdbStatus: row.tmdb_status,
    totalSeasons: row.total_seasons,
    totalEpisodes: row.total_episodes,
    nextEpisodeDate: row.next_episode_date,
    detailPath: row.detail_path,
    progressStatus: row.progress_status || "Planned",
    currentSeason: row.current_season,
    currentEpisode: row.current_episode,
    customSort: row.custom_sort,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
};

export const parseWatchlistID = (id) => {
  const [mediaType, tmdbID] = String(id || "").split(":");
  return { mediaType, tmdbID: toNumberOrNull(tmdbID) };
};
