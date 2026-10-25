import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { deleteAllMyPhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';

type SignUpPayload = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    affiliation?: string;
};

type SignInPayload = { email: string; password: string };

/**
 * Where email links (reset, confirmation) send people back to.
 *
 * Web: this site's own `/auth`. Native: the `accessall://auth` deep link,
 * which `auth-context` completes. Both must be listed under Supabase Auth →
 * URL Configuration → Redirect URLs.
 */
function authRedirectUrl() {
    return Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/auth`
        : Linking.createURL('auth');
}

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
                    emailRedirectTo: authRedirectUrl(),
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

/**
 * Emails a password reset link.
 *
 * The link signs the user in with a recovery session and lands on `/auth`,
 * which then offers the "choose a new password" form (see `useUpdatePassword`).
 * Supabase answers the same way whether or not the address has an account, so
 * this cannot be used to find out who is registered.
 */
export function useRequestPasswordReset() {
    return useMutation({
        mutationFn: async (email: string) => {
            const normalised = email.trim().toLowerCase();

            if (!normalised.includes('@')) {
                throw new Error('EMAIL_REQUIRED');
            }

            const { error } = await supabase.auth.resetPasswordForEmail(normalised, {
                redirectTo: authRedirectUrl(),
            });

            if (error) {
                throw new Error(error.message);
            }
        },
    });
}

export function useUpdatePassword() {
    return useMutation({
        mutationFn: async (password: string) => {
            if (password.length < MIN_PASSWORD_LENGTH) {
                throw new Error('INVALID_CREDENTIALS');
            }

            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                throw new Error(error.message);
            }
        },
    });
}

/**
 * Permanently deletes the signed-in account (`delete_my_account`), then
 * clears the now-orphaned local session.
 *
 * Photos go first: the bucket is public, and the database cannot reach into
 * storage, so a deleted student's photos would otherwise stay online.
 */
export function useDeleteAccount() {
    return useMutation({
        mutationFn: async () => {
            await deleteAllMyPhotos();
            const { error } = await supabase.rpc('delete_my_account');

            if (error) {
                throw new Error(error.message);
            }

            await supabase.auth.signOut({ scope: 'local' });
        },
    });
}

/**
 * Signs out everywhere when the server can be reached, and at least on this
 * device when it cannot — offline, a "global" sign-out fails and would leave
 * the button looking broken while the user stays signed in.
 */
export function useSignOut() {
    return useMutation({
        mutationFn: async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
                await supabase.auth.signOut({ scope: 'local' });
            }

            return null;
        },
    });
}
