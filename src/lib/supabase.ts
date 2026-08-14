import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * `.env.example` ships with `<project-ref>`-style placeholders. Copying it
 * without editing is the most likely setup mistake, and an unedited placeholder
 * is not a missing value — without this check the app starts up looking healthy
 * and then fails every query against a hostname that does not resolve.
 */
const isPlaceholder = (value: string) => value.includes('<') || value.includes('>');

/**
 * Set when the app was bundled without usable Supabase credentials.
 *
 * Reported rather than thrown: this module is imported before any component
 * renders, so throwing here takes the bundle down with a stack trace instead of
 * the explanation someone setting the project up actually needs. `_layout`
 * checks this and shows that explanation.
 */
export const supabaseConfigError = !supabaseUrl || !supabaseKey
    ? 'Missing Supabase configuration. Copy .env.example to .env, then set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    : isPlaceholder(supabaseUrl) || isPlaceholder(supabaseKey)
        ? 'Supabase configuration still contains the placeholders from ' +
          '.env.example. Replace them with your project URL and publishable key ' +
          'from the Supabase dashboard (Project Settings -> API Keys).'
        : null;

/**
 * True during `expo export` prerendering, where there is no `window` and so no
 * storage to persist a session into. Sessions are a client-side concern anyway:
 * the static HTML must not be built around one particular visitor.
 */
const isPrerender = typeof window === 'undefined';

/**
 * The publishable key is meant to ship in client bundles — it grants only what
 * row level security allows. Every table in `0001_init.sql` has RLS enabled, so
 * this key by itself cannot read another user's settings or write someone
 * else's review.
 */
// `createClient` validates the URL and throws on a malformed one, which would
// happen at module load — before `_layout` could render `supabaseConfigError`
// and explain the problem. Feed it a syntactically valid stand-in whenever the
// real configuration is unusable; no request is ever made with it, because the
// app renders the configuration screen instead of any data screen.
const clientUrl = supabaseConfigError ? 'https://unconfigured.supabase.co' : supabaseUrl!;
const clientKey = supabaseConfigError ? 'unconfigured' : supabaseKey!;

export const supabase = createClient<Database>(clientUrl, clientKey, {
    auth: {
        // Web has localStorage, which supabase-js picks up on its own. Native
        // needs AsyncStorage passed explicitly or the session dies with the
        // process and users are signed out on every cold start.
        storage: isPrerender || Platform.OS === 'web' ? undefined : AsyncStorage,
        persistSession: !isPrerender,
        autoRefreshToken: !isPrerender,
        // No magic-link or OAuth redirects yet, so there is never a session in
        // the URL to detect — and looking for one slows first paint on web.
        detectSessionInUrl: false,
    },
});

/**
 * Access tokens are short-lived. On native the refresh timer is suspended while
 * the app is backgrounded, so resume it when the user comes back, otherwise the
 * first request after a long background sits on an expired token.
 */
if (!isPrerender && Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}

/** Error thrown by hooks when an action needs a signed-in user. */
export const AUTH_REQUIRED = 'AUTH_REQUIRED';

/**
 * A PostgREST response, as the discriminated union it actually is: either data
 * with no error, or an error with no data.
 */
type PostgrestResult<T> =
    | { data: T; error: null }
    | { data: null; error: { message: string; code?: string } };

/**
 * Turns a PostgREST result into its data, or throws.
 *
 * React Query treats a thrown error as a failed query; returning `{ data, error }`
 * pairs would instead surface a "successful" query holding an error nobody
 * checked. Narrowing on the union also means `maybeSingle()` keeps its honest
 * `T | null` while `select()` loses the `null` it can never return.
 */
export function unwrap<T>(result: PostgrestResult<T>): T {
    if (result.error) {
        throw new Error(result.error.message);
    }

    return result.data;
}

/**
 * `unwrap` for a query that must have produced exactly one row.
 *
 * Used after `insert(...).select().single()`, where a missing row means the
 * write was silently dropped — almost always a row level security policy
 * refusing it — and a caller that reads on regardless would report success.
 */
export function unwrapOne<T>(
    // Deliberately not `PostgrestResult<T>`: inferring `T` across two union
    // members lets the error branch contribute `null` as a candidate, and the
    // two collapse to `never`. A single object shape infers from `data` alone.
    result: { data: T | null; error: { message: string; code?: string } | null },
    message = 'Row not found',
): NonNullable<T> {
    if (result.error) {
        throw new Error(result.error.message);
    }

    if (result.data === null || result.data === undefined) {
        throw new Error(message);
    }

    return result.data as NonNullable<T>;
}

/** The signed-in user's id, or a thrown `AUTH_REQUIRED` when there is none. */
export async function requireUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;

    if (!userId) {
        throw new Error(AUTH_REQUIRED);
    }

    return userId;
}
