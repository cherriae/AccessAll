import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type SignUpPayload = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    affiliation?: string;
};

type SignInPayload = { email: string; password: string };

/** Supabase enforces this too; checking here gives a message before a round trip. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Supabase returns human-readable prose. Screens switch on stable codes, so
 * translate once here rather than string-matching in the UI.
 */
function authErrorCode(message: string): string {
    const normalised = message.toLowerCase();

    if (normalised.includes('already registered') || normalised.includes('already been registered')) {
        return 'ACCOUNT_EXISTS';
    }

    if (normalised.includes('invalid login credentials')) {
        return 'INVALID_CREDENTIALS';
    }

    if (normalised.includes('email not confirmed')) {
        return 'CONFIRM_EMAIL';
    }

    return message;
}

export function useSignUp() {
    return useMutation({
        mutationFn: async (payload: SignUpPayload) => {
            const email = payload.email.trim().toLowerCase();

            if (!email.includes('@') || payload.password.length < MIN_PASSWORD_LENGTH) {
                throw new Error('INVALID_CREDENTIALS');
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password: payload.password,
                options: {
                    // Read by the `handle_new_user` trigger to populate the
                    // profile and settings rows in the same transaction as the
                    // auth record, so a user is never half-created.
                    data: {
                        first_name: payload.firstName.trim(),
                        last_name: payload.lastName.trim(),
                        affiliation: payload.affiliation?.trim() ?? '',
                    },
                },
            });

            if (error) {
                throw new Error(authErrorCode(error.message));
            }

            // With email confirmation switched on, sign-up succeeds but hands
            // back no session — the account is real, it just cannot act yet.
            if (!data.session) {
                throw new Error('CONFIRM_EMAIL');
            }

            return data.session.user;
        },
    });
}

export function useSignIn() {
    return useMutation({
        mutationFn: async (payload: SignInPayload) => {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: payload.email.trim().toLowerCase(),
                password: payload.password,
            });

            if (error) {
                throw new Error(authErrorCode(error.message));
            }

            return data.user;
        },
    });
}

export function useSignOut() {
    return useMutation({
        mutationFn: async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
                throw new Error(error.message);
            }

            return null;
        },
    });
}
