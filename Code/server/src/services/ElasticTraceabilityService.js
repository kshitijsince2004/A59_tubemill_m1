/**
 * Optional Elasticsearch soft stub for Traceability.
 * A59 has no ES client configured — always unavailable; routes fall back to Postgres.
 */

export function isAvailable() {
  return false;
}

/**
 * Fuzzy multi-field search. Returns null when ES is down (caller uses Postgres).
 * @param {string} _q
 * @returns {Promise<null | { batchNumber: string, coilNo: string, customer: string, grade: string, score: number }[]>}
 */
export async function search(_q) {
  return null;
}

/**
 * Autocomplete suggestions from ES completion.
 * @param {string} _q
 * @returns {Promise<{ text: string, type: 'batch'|'coil', score: number }[]>}
 */
export async function suggest(_q) {
  return [];
}

export default { isAvailable, search, suggest };
