import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = {
    session: Session | null;
    userId: string | null;
    /** False until the persisted session has been read back from storage. */
    isReady: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, userId: null, isReady: false });

/**
 * Holds the Supabase session for the whole app.
 *
 * This replaces the old single-row `session` table in SQLite. Sign-in state now
 * lives in a signed JWT that the client refreshes on its own, and every query
 * this app makes is authorised against it by row level security — so there is
 * nothing to keep in the database and nothing to keep in sync.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [session, setSession] = useState<Session | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) {
                return;
            }

            setSession(data.session);
            setIsReady(true);
        });

        const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
            setSession(next);
            setIsReady(true);

            // Every cached query was fetched as somebody — either a different
            // user or nobody. Dropping the cache on a real identity change
            // stops one account's activity feed flashing up under another's.
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
                queryClient.clear();
            }
        });

        return () => {
            cancelled = true;
            subscription.subscription.unsubscribe();
        };
    }, [queryClient]);

    return (
        <AuthContext.Provider value={{ session, userId: session?.user.id ?? null, isReady }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthSession() {
    return useContext(AuthContext);
}

/** Convenience for screens that only need to know whether anyone is signed in. */
export function useIsSignedIn() {
    return useContext(AuthContext).userId !== null;
}
