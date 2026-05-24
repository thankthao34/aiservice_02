const GUEST_KEY = 'guest';

function getUserKey(user) {
  if (!user) return GUEST_KEY;
  return String(user.id || user._id || user.email || GUEST_KEY).trim() || GUEST_KEY;
}

export function getSearchHistoryKey(user) {
  return `nexus_search_history:${getUserKey(user)}`;
}

export function readSearchHistory(user, fallback = []) {
  try {
    const raw = localStorage.getItem(getSearchHistoryKey(user)) || JSON.stringify(fallback);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(getSearchHistoryKey(user));
    return [];
  }
}

export function saveSearchHistory(user, history) {
  try {
    localStorage.setItem(getSearchHistoryKey(user), JSON.stringify(Array.isArray(history) ? history : []));
  } catch {
    // ignore
  }
}

export function clearSearchHistory(user) {
  localStorage.removeItem(getSearchHistoryKey(user));
}
