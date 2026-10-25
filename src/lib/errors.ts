import { AUTH_REQUIRED } from './supabase';

/**
 * Server refusals worth showing word for word, because they tell the user what
 * to do (wait, or stop editing) — unlike a database error, which never should.
 * Raised by triggers in migration 0010.
 */
const USER_FACING = [
    'You are posting too quickly',
    'This report can no longer be reworded',
];

/** The message to show for a failed action, or `fallback` for anything unexpected. */
export function errorText(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : '';
    if (message === AUTH_REQUIRED) return 'Sign in to continue.';
    return USER_FACING.find((known) => message.startsWith(known)) ? message : fallback;
}
