export const capitalizeFirstLetter = (string) => `${string?.charAt(0)?.toUpperCase()}${string?.slice(1)}`;

export const convertToSlug = (string) => string?.toLowerCase().replace(/[\s/]+/g, '-');

export const splitSlug = (string) => {
  if (!string) return [];
  return string.split('-');
};