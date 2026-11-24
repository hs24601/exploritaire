// Node module hook for the no-browser render tools: resolves the repo's
// extensionless relative imports (as Vite does) to .ts / .tsx files.
// Usage: node --import ./tools/ts-resolve.mjs tools/<script>.mjs
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL) {
    for (const ext of ['.ts', '.tsx']) {
      const url = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  return next(specifier, context);
}

// Registering this same file installs `resolve` above as the hook.
if (!globalThis.__exploritaireTsResolve) { globalThis.__exploritaireTsResolve = true; register(import.meta.url); }
