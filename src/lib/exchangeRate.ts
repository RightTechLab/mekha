const CACHE_TTL_MS = 30_000;

let cache: { rate: number; fetchedAt: number } | null = null;

export async function getBtcRateThb(): Promise<number> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rate;
  }
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=thb'
  );
  if (!res.ok) {
    throw new Error('Failed to fetch exchange rate');
  }
  const data = await res.json();
  const rate = data.bitcoin.thb as number;
  cache = { rate, fetchedAt: Date.now() };
  return rate;
}

export function getCachedRate(): { rate: number; fetchedAt: number } | null {
  return cache;
}

export function thbToSats(amountThb: number, btcRateThb: number): number {
  return Math.round((amountThb / btcRateThb) * 1e8);
}
