/**
 * lib/init.ts
 * Inicializa o banco (migrations + seed) na primeira chamada de API.
 * Usa flag global para rodar apenas uma vez por processo.
 */

import { runMigrations } from './migrations';
import { runSeed } from './seed';

declare global {
  // eslint-disable-next-line no-var
  var __dbInitialized: boolean | undefined;
  // eslint-disable-next-line no-var
  var __dbInitPromise: Promise<void> | undefined;
}

export async function initDb() {
  if (globalThis.__dbInitialized) return;
  if (globalThis.__dbInitPromise) return globalThis.__dbInitPromise;

  globalThis.__dbInitPromise = (async () => {
    await runMigrations();
    await runSeed();
    globalThis.__dbInitialized = true;
  })();

  return globalThis.__dbInitPromise;
}
