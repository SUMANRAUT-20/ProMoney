/**
 * Live exchange rates — open.er-api.com (free, no API key).
 *
 * Rates are fetched per BASE currency (the user's Settings base
 * currency) and cached in localStorage for 12 hours. The provider
 * updates rates roughly once a day, so a 12h cache loses nothing.
 *
 * Honesty rules (same as the rest of ProMoney — never invent data):
 * - No rate is ever hardcoded or guessed. If the fetch fails and no
 *   cache exists, conversion returns null and the caller must refuse
 *   the foreign-currency entry (or let the user enter in base).
 * - A stale cache IS used when offline, but it is flagged `stale` so
 *   the UI can label it "(cached rate)" instead of pretending it is
 *   live.
 *
 * Conversion model: a foreign-currency transaction stores the amount
 * as entered (tx.amount + tx.currency), the base-currency value
 * converted at entry time (tx.base_amount, whole base units), and the
 * rate used (tx.fx_rate = base units per 1 foreign unit). Dashboard
 * and all totals aggregate base_amount, so history never shifts when
 * rates move later.
 */

const ENDPOINT = 'https://open.er-api.com/v6/latest';
const CACHE_KEY = 'pm_fx_rates_v1';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function loadCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors — rates just refetch next time.
  }
}

/**
 * Returns { rates, date, stale } for the base currency, or null when
 * no rates are available at all (offline + nothing cached). `rates`
 * maps currency code -> units of that currency per 1 unit of base
 * (the provider's shape). `date` is the provider's rate date.
 */
export async function getRates(base) {
  const cache = loadCache();
  const cached = cache[base];
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < MAX_AGE_MS) {
    return { rates: cached.rates, date: cached.rate_date, stale: false };
  }
  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(base)}`);
    if (!response.ok) throw new Error(`FX request failed: ${response.status}`);
    const payload = await response.json();
    if (payload.result !== 'success' || !payload.rates) throw new Error('FX payload malformed');
    const entry = {
      rates: payload.rates,
      rate_date: payload.time_last_update_utc || null,
      fetched_at: new Date().toISOString(),
    };
    cache[base] = entry;
    saveCache(cache);
    return { rates: entry.rates, date: entry.rate_date, stale: false };
  } catch {
    if (cached) return { rates: cached.rates, date: cached.rate_date, stale: true };
    return null;
  }
}

/**
 * Converts an amount entered in `from` into the base currency.
 * Returns { baseAmount, rate, date, stale } — baseAmount is a whole
 * number of base units (JPY-style integer rule) — or null when no
 * rate is available. Same-currency "conversion" is exact (rate 1).
 */
export async function convertToBase(amount, from, base) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  if (from === base) {
    return { baseAmount: Math.round(value), rate: 1, date: null, stale: false };
  }
  const table = await getRates(base);
  if (!table) return null;
  const perBase = table.rates[from];
  if (!perBase) return null;
  const rate = 1 / perBase; // base units per 1 unit of `from`
  return {
    baseAmount: Math.round(value * rate),
    rate: Math.round(rate * 1e6) / 1e6,
    date: table.date,
    stale: table.stale,
  };
}
