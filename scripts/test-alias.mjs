// Lets `npm test` (plain Node, no bundler) resolve the `@/…` path alias that
// tsconfig and Metro understand, and the extensionless imports Metro allows.
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = new URL('../src/', import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = new URL(specifier.slice(2), src);
    for (const candidate of ['', '.ts', '.tsx', '/index.ts']) {
      const url = new URL(base.href + candidate);
      if (existsSync(fileURLToPath(url)) && (candidate || /\.tsx?$/.test(url.pathname))) {
        return next(url.href, context);
      }
    }
  }
  return next(specifier, context);
}

if (!process.env.__TEST_ALIAS_REGISTERED) {
  process.env.__TEST_ALIAS_REGISTERED = '1';
  register(import.meta.url, pathToFileURL('./'));
}
