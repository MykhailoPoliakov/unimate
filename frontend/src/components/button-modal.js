export const LINK_COLORS = ['#E8A317', '#E13F2B', '#2F5FA8', '#1C1C1C', '#0F9D58', '#7C5CFC', '#1877F2', '#9B1B30'];
export const DEFAULT_LINK_COLOR = LINK_COLORS[0];

export function linksStorageKey(userId) {
  return `unimate.localLinks.${userId}`;
}
