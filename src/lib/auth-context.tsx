import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

type AuthState = {
    session: Session | null;
    userId: string | null;
    /** False until the persisted session has been read back from storage. */
    isReady: boolean;
    /** True after arriving from a password reset link, until a new password is set. */
    isRecovering: boolean;
    endRecovery: () => void;
};

const AuthContext = createContext<AuthState>({
    session: null,
    userId: null,
    isReady: false,
    isRecovering: false,
    endRecovery: () => {},
});

/**
 * Set as soon as Supabase reports a password-recovery sign-in.
 *
 * Subscribed at module load rather than in `AuthProvider`: on web, supabase-js
 * reads the reset link from the address bar while the app is still waiting for
 * fonts, and emits `PASSWORD_RECOVERY` exactly once. A listener added when the
 * provider later mounts would miss it and show the ordinary sign-in form.
 */
let recoveryPending = false;
supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoveryPending = true;
    if (event === 'SIGNED_OUT') recoveryPending = false;
});

/**
 * Completes an email link (password reset or sign-up confirmation) opened on a
 * phone. Web does this itself via `detectSessionInUrl`.
 */
async function handleAuthLink(url: string | null) {
    if (!url) return;
    const code = Linking.parse(url).queryParams?.code;
    if (typeof code === 'string' && code) {
        // Errors (an expired or already-used link) leave the user signed out
        // on the sign-in form, which is the right place to try again.
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
    }
}

/**
 * Holds the Supabase session for the whole app.
 *
 * Sign-in state lives in a signed JWT that the client refreshes on its own, and
 * every query this app makes is authorised against it by row level security.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [session, setSession] = useState<Session | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isRecovering, setIsRecovering] = useState(recoveryPending);
    const lastUserId = useRef<string | null | undefined>(undefined);
    const incomingUrl = Linking.useURL();

    useEffect(() => {
        if (Platform.OS !== 'web') handleAuthLink(incomingUrl);
    }, [incomingUrl]);

    useEffect(() => {
        let cancelled = false;

        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) {
                return;
            }

            lastUserId.current = data.session?.user.id ?? null;
            setSession(data.session);
            setIsReady(true);
        });

        const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
            setSession(next);
            setIsReady(true);

            if (event === 'PASSWORD_RECOVERY') setIsRecovering(true);
            if (event === 'SIGNED_OUT') setIsRecovering(false);

            // Every cached query was fetched as somebody. Drop the cache only
            // when that somebody changes: supabase-js can re-emit SIGNED_IN for
            // the same user (e.g. when a browser tab regains focus), and
            // clearing then would flash every screen back to loading.
            const nextUserId = next?.user.id ?? null;
            if (lastUserId.current !== undefined && nextUserId !== lastUserId.current) {
                queryClient.clear();
            }
            lastUserId.current = nextUserId;
        });

        return () => {
            cancelled = true;
            subscription.subscription.unsubscribe();
        };
    }, [queryClient]);

    return (
        <AuthContext.Provider
            value={{
                session,
                userId: session?.user.id ?? null,
                isReady,
                isRecovering,
                endRecovery: () => {
                    recoveryPending = false;
                    setIsRecovering(false);
                },
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthSession() {
    return useContext(AuthContext);
}
