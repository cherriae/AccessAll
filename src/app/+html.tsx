import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/constants/theme';

/**
 * The HTML shell for web. Not a route — Expo Router uses this to generate
 * `index.html`, and it runs only at build time on the server.
 *
 * Its job here is to paint the page background before the JS bundle loads.
 * Anything in `global.css` is bundled *into* that JS, so it applies too late to
 * prevent a flash; a `<style>` tag in this head is parsed on the first paint.
 */

/**
 * Inlined rather than imported so it lands in the head as plain CSS.
 *
 * Reads the palette straight from `theme.ts`, so unlike a hand-written
 * stylesheet these cannot drift from the tokens.
 */
const THEME_BACKGROUND_CSS = `
:root { color-scheme: light dark; }
html, body { background-color: ${Colors.light.background}; }
@media (prefers-color-scheme: dark) {
  html, body { background-color: ${Colors.dark.background}; }
}
`;

export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* Required: disables body scrolling so `ScrollView` behaves like native. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: THEME_BACKGROUND_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
