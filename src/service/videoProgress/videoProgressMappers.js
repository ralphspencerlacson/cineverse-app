// Converts local playback progress keys into normalized Supabase progress rows.
export const parseProgressKey = (key) => {
  if (!key || typeof key !== "string") {
    return null;
  }

  const movieMatch = key.match(/^movie:(\d+)$/);
  if (movieMatch) {
    return {
      contentType: "movie",
      tmdbID: Number(movieMatch[1]),
      seasonNumber: 0,
      episodeNumber: 0,
    };
  }

  const episodeMatch = key.match(/^tv:(\d+):s(\d+):e(\d+)$/i);
  if (episodeMatch) {
    return {
      contentType: "tv",
      tmdbID: Number(episodeMatch[1]),
      seasonNumber: Number(episodeMatch[2]),
      episodeNumber: Number(episodeMatch[3]),
    };
  }

  return null;
};

export const buildProgressKey = (row) => {
  if (row.content_type === "movie") {
    return `movie:${row.tmdb_id}`;
  }

  if (row.content_type === "tv" || row.content_type === "episode") {
    return `tv:${row.tmdb_id}:s${row.season_number}:e${row.episode_number}`;
  }

  return null;
};

export const toVideoProgressRow = (userID, entry) => {
  const parsedKey = parseProgressKey(entry?.key);
  if (!userID || !entry?.seconds || !parsedKey) {
    return null;
  }

  return {
    user_id: userID,
    content_type: parsedKey.contentType,
    tmdb_id: parsedKey.tmdbID,
    season_number: parsedKey.seasonNumber,
    episode_number: parsedKey.episodeNumber,
    current_progress: Math.floor(Number(entry.seconds) || 0),
    is_finished: Boolean(entry.isFinished),
    finished_at: entry.finishedAt || null,
    metadata: entry.metadata || null,
    updated_at: entry.updatedAt || new Date().toISOString(),
  };
};

export const fromVideoProgressRow = (row) => {
  const key = buildProgressKey(row);
  if (!key || !row.current_progress) {
    return null;
  }

  return {
    key,
    seconds: Math.floor(Number(row.current_progress) || 0),
    updatedAt: row.updated_at,
    metadata: row.metadata || null,
    isFinished: row.is_finished,
    finishedAt: row.finished_at,
    remoteID: row.id,
  };
};
