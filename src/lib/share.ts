import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Opens the share sheet, or copies the text where there is no share sheet.
 *
 * On react-native-web `Share.share` needs `navigator.share`, which desktop
 * Chrome and Firefox do not have — the button used to do nothing there.
 */
export async function shareText(message: string, title?: string): Promise<ShareOutcome> {
    const browser = Platform.OS === 'web' ? (globalThis.navigator as Navigator | undefined) : undefined;
    if (browser && typeof browser.share !== 'function') {
        try {
            await browser.clipboard.writeText(message);
            return 'copied';
        } catch {
            return 'failed';
        }
    }

    try {
        await Share.share({ message, title });
        return 'shared';
    } catch {
        return 'failed';
    }
}

/**
 * A link to a screen that works for anyone who receives it.
 *
 * An app deep link (`accessall://…`) means nothing to a principal opening an
 * email on a school computer, so links meant for other people use the public
 * web address: this page's origin on web, `EXPO_PUBLIC_WEB_URL` in the apps.
 * Undefined when the app does not know a public address.
 */
export function publicUrl(path: string): string | undefined {
    if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
    const base = process.env.EXPO_PUBLIC_WEB_URL;
    return base ? `${base.replace(/\/$/, '')}${path}` : undefined;
}
