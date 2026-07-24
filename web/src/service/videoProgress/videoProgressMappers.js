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
      seasonNumber: null,
      episodeNumber: null,
    };
  }

  const episodeMatch = key.match(/^tv:(\d+):s(\d+):e(\d+)$/i);
  if (episodeMatch) {
    return {
      contentType: "episode",
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

  const seconds = Math.floor(Number(entry.seconds) || 0);
  const duration = Number(entry.metadata?.playbackDuration || entry.metadata?.duration || 0);
  const currentProgress = Number.isFinite(duration) && duration > 0
    ? Math.min(100, Math.max(0, Math.round((seconds / duration) * 100)))
    : Math.min(100, Math.max(0, seconds));
  const metadata = {
    ...(entry.metadata || {}),
    playbackSeconds: seconds,
    ...(duration > 0 ? { playbackDuration: duration } : {}),
  };

  return {
    user_id: userID,
    content_type: parsedKey.contentType,
    tmdb_id: parsedKey.tmdbID,
    season_number: parsedKey.seasonNumber,
    episode_number: parsedKey.episodeNumber,
    current_progress: currentProgress,
    is_finished: Boolean(entry.isFinished),
    finished_at: entry.finishedAt || null,
    metadata,
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
    seconds: Math.floor(Number(row.metadata?.playbackSeconds ?? row.current_progress) || 0),
    updatedAt: row.updated_at,
    metadata: row.metadata || null,
    isFinished: row.is_finished,
    finishedAt: row.finished_at,
    remoteID: row.id,
  };
};
