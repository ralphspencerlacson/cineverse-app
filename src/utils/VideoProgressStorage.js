export const VIDEO_PROGRESS_STORAGE_KEY = "cineverse-vid-progress";

const isBrowser = () => typeof window !== "undefined";

const normalizeProgressEntry = (value, fallbackKey) => {
  if (typeof value === "number") {
    return {
      key: fallbackKey,
      seconds: Math.floor(value),
      updatedAt: null,
      metadata: null,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const seconds = Number(value.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return {
    key: value.key || fallbackKey,
    seconds: Math.floor(seconds),
    updatedAt: value.updatedAt || null,
    metadata: value.metadata || null,
  };
};

export const getVideoProgressMap = () => {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(VIDEO_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

export const getVideoProgressEntries = () => {
  return Object.entries(getVideoProgressMap())
    .map(([key, value]) => normalizeProgressEntry(value, key))
    .filter(Boolean);
};

export const getStoredVideoProgress = (key) => {
  const keys = Array.isArray(key) ? key : [key];
  const map = getVideoProgressMap();

  for (const currentKey of keys) {
    const entry = normalizeProgressEntry(map[currentKey], currentKey);
    if (entry?.seconds > 0) {
      return entry.seconds;
    }
  }

  return 0;
};

export const setStoredVideoProgress = (key, seconds, metadata = null) => {
  const keys = Array.isArray(key) ? key : [key];

  if (!keys.length || !isBrowser()) {
    return;
  }

  const progress = Number(seconds);
  if (!Number.isFinite(progress) || progress < 1) {
    return;
  }

  const map = getVideoProgressMap();
  const updatedAt = new Date().toISOString();

  for (const currentKey of keys) {
    map[currentKey] = {
      key: currentKey,
      seconds: Math.floor(progress),
      updatedAt,
      metadata,
    };
  }

  try {
    window.localStorage.setItem(VIDEO_PROGRESS_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent("cineverse-video-progress", {
        detail: { keys, seconds: Math.floor(progress), metadata },
      })
    );
  } catch {
    return;
  }
};
