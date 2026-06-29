export const WATCHLIST_STORAGE_KEY = "cineverse-watchlist";

export const WATCH_STATUS_OPTIONS = [
  "Planned",
  "Watching",
  "Ongoing",
  "Completed",
  "Dropped",
];

const isBrowser = () => typeof window !== "undefined";

const normalizeItem = (item) => {
  if (!item || !item.id || !item.tmdbID || !item.type || !item.title) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    progressStatus: "Planned",
    currentSeason: item.type === "tv" ? 1 : null,
    currentEpisode: item.type === "tv" ? 1 : null,
    addedAt: now,
    updatedAt: now,
    ...item,
  };
};

export const getWatchlist = () => {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const saveWatchlist = (items) => {
  if (!isBrowser() || !Array.isArray(items)) {
    return [];
  }

  const normalizedItems = items.map(normalizeItem).filter(Boolean);

  try {
    window.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify(normalizedItems)
    );
  } catch {
    return getWatchlist();
  }

  return normalizedItems;
};

export const isInWatchlist = (id) => {
  return getWatchlist().some((item) => item.id === id);
};

export const addToWatchlist = (item) => {
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem) {
    return getWatchlist();
  }

  const items = getWatchlist();
  const existingItem = items.find((currentItem) => currentItem.id === normalizedItem.id);

  if (existingItem) {
    return items;
  }

  return saveWatchlist([...items, normalizedItem]);
};

export const removeFromWatchlist = (id) => {
  return saveWatchlist(getWatchlist().filter((item) => item.id !== id));
};

export const updateWatchlistItem = (id, updates) => {
  const updatedAt = new Date().toISOString();
  const items = getWatchlist().map((item) =>
    item.id === id ? { ...item, ...updates, updatedAt } : item
  );

  return saveWatchlist(items);
};

export const mergeWatchlist = (incomingItems) => {
  if (!Array.isArray(incomingItems)) {
    return getWatchlist();
  }

  const itemMap = new Map(getWatchlist().map((item) => [item.id, item]));

  incomingItems.forEach((incomingItem) => {
    const normalizedItem = normalizeItem(incomingItem);
    if (!normalizedItem) {
      return;
    }

    const existingItem = itemMap.get(normalizedItem.id);
    if (!existingItem) {
      itemMap.set(normalizedItem.id, normalizedItem);
      return;
    }

    const existingDate = new Date(existingItem.updatedAt || existingItem.addedAt || 0);
    const incomingDate = new Date(normalizedItem.updatedAt || normalizedItem.addedAt || 0);
    itemMap.set(
      normalizedItem.id,
      incomingDate > existingDate ? normalizedItem : existingItem
    );
  });

  return saveWatchlist(Array.from(itemMap.values()));
};
