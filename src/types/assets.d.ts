/**
 * Ambient declarations for non-code imports.
 *
 * `src/global.css` is imported for its side effects on web; Metro handles it at
 * bundle time and native builds drop it, but TypeScript still needs to be told
 * the module exists.
 */

declare module '*.css';
