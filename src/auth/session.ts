/**
 * Inactivity-based session expiry. The last activity time and the timeout are kept
 * in localStorage so they survive refreshes and are shared between tabs.
 */
export const ACTIVITY_KEY = 'demobank:last-activity';
export const TIMEOUT_KEY = 'demobank:session-timeout';
export const DEFAULT_TIMEOUT_MINUTES = 15;
export const TIMEOUT_OPTIONS = [1, 2, 5, 15, 30, 60];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** Set when the session ends because of inactivity, so the login redirect can say why. */
let expiredFlag = false;
export const markExpired = () => {
  expiredFlag = true;
};
export const wasExpired = () => expiredFlag;

export function getTimeoutMinutes(): number {
  const n = Number(read(TIMEOUT_KEY));
  return TIMEOUT_OPTIONS.includes(n) ? n : DEFAULT_TIMEOUT_MINUTES;
}

export function setTimeoutMinutes(minutes: number) {
  write(TIMEOUT_KEY, String(minutes));
}

export function touchActivity() {
  expiredFlag = false;
  write(ACTIVITY_KEY, String(Date.now()));
}

export function lastActivity(): number {
  const n = Number(read(ACTIVITY_KEY));
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}

export function clearActivity() {
  write(ACTIVITY_KEY, null);
}

/** Milliseconds until the session expires (can be negative). */
export function remainingMs(): number {
  return lastActivity() + getTimeoutMinutes() * 60_000 - Date.now();
}
