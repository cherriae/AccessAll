import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'onboarding:done';

/**
 * Whether this device has seen the first-launch walkthrough.
 *
 * Per device, not per account: it explains the app, which someone needs before
 * they have an account at all.
 */
export function useOnboardingDone(): boolean | null {
    const [done, setDone] = useState<boolean | null>(null);

    useEffect(() => {
        let active = true;
        AsyncStorage.getItem(KEY)
            .then((value) => active && setDone(value === '1'))
            // Storage unavailable: never trap someone in the walkthrough.
            .catch(() => active && setDone(true));
        return () => {
            active = false;
        };
    }, []);

    return done;
}

export function markOnboardingDone() {
    return AsyncStorage.setItem(KEY, '1').catch(() => {});
}
