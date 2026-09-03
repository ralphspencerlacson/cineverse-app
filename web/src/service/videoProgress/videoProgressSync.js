// Syncs local and remote playback progress, resolving conflicts by newest update time.
import { getRemoteVideoProgressEntries, upsertRemoteVideoProgressEntries } from "./videoProgressRemote";
import {
  getVideoProgressEntries,
  replaceActiveVideoProgress,
  setActiveVideoProgressUser,
} from "./videoProgressStorage";

const getLatestEntry = (firstEntry, secondEntry) => {
  const firstDate = new Date(firstEntry?.updatedAt || 0);
  const secondDate = new Date(secondEntry?.updatedAt || 0);

  return secondDate > firstDate ? secondEntry : firstEntry;
};

const mergeProgressEntries = (localEntries, remoteEntries) => {
  const entryMap = new Map();

  [...localEntries, ...remoteEntries].forEach((entry) => {
    if (!entry?.key) {
      return;
    }

    const existingEntry = entryMap.get(entry.key);
    entryMap.set(entry.key, existingEntry ? getLatestEntry(existingEntry, entry) : entry);
  });

  return Array.from(entryMap.values());
};

export const syncVideoProgressForUser = async (userID) => {
  if (!userID) {
    return [];
  }

  setActiveVideoProgressUser(userID);

  const localEntries = getVideoProgressEntries();
  const remoteEntries = await getRemoteVideoProgressEntries(userID);
  const mergedEntries = mergeProgressEntries(
    mergeProgressEntries(localEntries, remoteEntries),
    getVideoProgressEntries()
  );

  const replacedMap = replaceActiveVideoProgress(mergedEntries, {
    mergeCurrent: true,
  });
  const currentMergedEntries = Object.values(replacedMap);
  await upsertRemoteVideoProgressEntries(userID, currentMergedEntries);

  return currentMergedEntries;
};
