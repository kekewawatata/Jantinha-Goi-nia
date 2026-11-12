/**
 * lib/db.ts
 * Conexão MySQL via mysql2/promise (otimizada para ambientes serverless, locais e Hostinger).
 */

import mysql from 'mysql2/promise';

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var __dbMemoryCache: Map<string, { data: unknown; expiresAt: number }> | undefined;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host:               process.env.MYSQL_HOST     ?? 'localhost',
    port:               Number(process.env.MYSQL_PORT ?? 3306),
    user:               process.env.MYSQL_USER     ?? 'root',
    password:           process.env.MYSQL_PASSWORD ?? '',
    database:           process.env.MYSQL_DATABASE ?? 'jantinha',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    enableKeepAlive:    true,
    keepAliveInitialDelay: 10000,
    maxIdle:            10,
    idleTimeout:        60000,
    charset:            'utf8mb4',
    timezone:           'Z',
  });
}

export const pool: mysql.Pool =
  globalThis.__mysqlPool ?? (globalThis.__mysqlPool = createPool());

/** Executa SELECT e retorna todas as linhas */
export async function query<T = Record<string, unknown>>(
  sql: string,
  args: any[] = []
): Promise<T[]> {
  const [rows] = await pool.execute(sql, args as any);
  return rows as T[];
}

/** Executa SELECT e retorna apenas a primeira linha */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  args: any[] = []
): Promise<T | undefined> {
  const rows = await query<T>(sql, args);
  return rows[0];
}

/** Executa INSERT / UPDATE / DELETE com retorno do cabeçalho */
export async function exec(
  sql: string,
  args: any[] = []
): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, args as any);
  return result as mysql.ResultSetHeader;
}

/**
 * Executa múltiplas operações dentro de uma transação ACID segura.
 * Garante commit automático e rollback em caso de falha, liberando a conexão.
 */
export async function withTransaction<T>(
  callback: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Cache simples em memória com TTL (Time-To-Live) para dados que mudam com pouca frequência (ex: cardápio).
 */
const cache = globalThis.__dbMemoryCache ?? (globalThis.__dbMemoryCache = new Map());

export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }
  const fresh = await fetchFn();
  cache.set(key, { data: fresh, expiresAt: now + ttlMs });
  return fresh;
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export default pool;
