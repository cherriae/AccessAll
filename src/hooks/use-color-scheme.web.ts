import { useSyncExternalStore } from 'react';
import type { ColorSchemeName } from 'react-native';

/**
 * Web implementation of `useColorScheme`.
 *
 * `app.json` sets `web.output: "static"`, so the HTML is prerendered with no
 * knowledge of the visitor's scheme and has to assume light. The previous
 * approach flipped to the real value inside `useEffect`, which meant dark-mode
 * users saw a full light-themed paint first.
 *
 * `useSyncExternalStore` fixes the ordering: React uses `getServerSnapshot`
 * while hydrating, then re-renders with the real value as part of that same
 * pass rather than an effect later. `src/global.css` covers the window before
 * hydration by painting the page background from a CSS media query.
 */

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Older browsers and the prerender pass have no `matchMedia`. */
function canQuery(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function subscribe(onStoreChange: () => void): () => void {
  if (!canQuery()) {
    return () => {};
  }
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

function getSnapshot(): ColorSchemeName {
  if (!canQuery()) {
    return 'light';
  }
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** Must stay stable across renders, and must match what the CSS assumes. */
function getServerSnapshot(): ColorSchemeName {
  return 'light';
}

export function useColorScheme(): ColorSchemeName {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
