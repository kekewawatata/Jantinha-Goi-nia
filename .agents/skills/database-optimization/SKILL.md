---
name: database-optimization
description: "Best practices, indexing patterns, connection pool management, and transactional integrity for MySQL and relational databases in Node.js / Next.js applications."
risk: medium
source: community
date_added: "2026-03-01"
---

# Database Optimization & Connection Resilience Playbook

## Purpose
Optimize relational database access (specifically MySQL / MariaDB via `mysql2`) in full-stack Next.js environments to prevent connection exhaustion, slow queries, race conditions, and data inconsistency.

## Core Rules

### 1. Connection Pool Singleton & Reuse
- Never recreate connection pools on every request or hot reload in development.
- Maintain a single global connection pool (`globalThis.mysqlPool`).
- Configure sensible pool boundaries:
  - `connectionLimit: 10` (prevents overwhelming shared hosting like Hostinger).
  - `waitForConnections: true` and `queueLimit: 0`.
  - `enableKeepAlive: true` with `keepAliveInitialDelay: 10000` to prevent dropouts.

### 2. Strategic Indexing
- Every foreign key and status column used in `WHERE`, `ORDER BY`, or `JOIN` clauses must be indexed:
  - `INDEX idx_pedidos_mesa_id (mesa_id)`
  - `INDEX idx_pedidos_status (status)`
  - `INDEX idx_pedidos_created_at (criado_em)`
  - `INDEX idx_itens_pedido_pedido_id (pedido_id)`

### 3. Transactional Integrity for Financial & Status Changes
- Multi-step operations (e.g., closing a table, updating stock, creating a payment) must execute inside a transaction:
  ```ts
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // business operations...
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  ```

### 4. Query Efficiency & In-Memory Caching
- Avoid N+1 queries. Fetch orders with their items using `JOIN` or batched lookups (`WHERE id IN (...)`).
- Cache static or slow-changing data (e.g. categories, active menu items) with short TTL or in-memory map to drastically cut database roundtrips.
