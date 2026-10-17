import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
    },
});

/**
 * React Query refetches stale data when the window regains focus, but it only
 * knows about browser windows. On a phone, "focus" is the app coming back to
 * the foreground — without this, a reply to your report would not show on the
 * bell until the app was restarted.
 */
if (Platform.OS !== 'web') {
    focusManager.setEventListener((handleFocus) => {
        const subscription = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
        return () => subscription.remove();
    });
}
