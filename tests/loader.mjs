/** Resolves TypeScript's extensionless imports and the `@/` path alias for
 *  node:test, which reads neither tsconfig nor Next's resolver. */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as resolvePath, dirname } from 'node:path';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

function firstExisting(base) {
  for (const c of [base + '.ts', base + '.tsx', resolvePath(base, 'index.ts'), base]) {
    if (existsSync(c) && !c.endsWith('/')) return c;
  }
  return null;
}

export function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith('@/')) {
    base = resolvePath(ROOT, specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    if (/\.(ts|tsx|mjs|js|json)$/.test(specifier)) return next(specifier, context);
    const from = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : ROOT;
    base = resolvePath(from, specifier);
  }
  if (base) {
    const hit = firstExisting(base);
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  return next(specifier, context);
}
