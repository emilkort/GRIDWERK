import type Database from 'better-sqlite3'

/** Get a COUNT(*) result from a query. Avoids `as { c: number }` casts everywhere. */
export function countQuery(db: Database.Database, sql: string, ...params: any[]): number {
  return (db.prepare(sql).get(...params) as { c: number }).c
}

/** Get a single scalar value from a query (first column of first row). */
export function scalarQuery<T = number>(db: Database.Database, sql: string, ...params: any[]): T | null {
  const row = db.prepare(sql).get(...params) as Record<string, T> | undefined
  if (!row) return null
  const keys = Object.keys(row)
  return keys.length > 0 ? row[keys[0]] : null
}
