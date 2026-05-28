interface LnurlPayResponse {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  tag: string;
}

interface LnurlInvoiceResponse {
  pr: string;
  routes: unknown[];
  verify?: string;
  successAction?: { tag: string; message?: string; url?: string };
}

export interface InvoiceResult {
  pr: string;
  verify: string | null;
}

export interface LnTimingLog {
  t0_userTap: number;
  t1_startFetchLnurl?: number;
  t2_gotCallback?: number;
  t3_startFetchInvoice?: number;
  t4_gotInvoice?: number;
  t5_qrRendered?: number;
}

export function createTimingLog(): LnTimingLog {
  return { t0_userTap: Date.now() };
}

export function reportTimingLog(log: LnTimingLog): void {
  const entries: string[] = [];
  if (log.t1_startFetchLnurl && log.t0_userTap)
    entries.push(`T0→T1 (tap→fetch LNURL): ${log.t1_startFetchLnurl - log.t0_userTap}ms`);
  if (log.t2_gotCallback && log.t1_startFetchLnurl)
    entries.push(`T1→T2 (fetch→callback): ${log.t2_gotCallback - log.t1_startFetchLnurl}ms`);
  if (log.t3_startFetchInvoice && log.t2_gotCallback)
    entries.push(`T2→T3 (callback→fetch invoice): ${log.t3_startFetchInvoice - log.t2_gotCallback}ms`);
  if (log.t4_gotInvoice && log.t3_startFetchInvoice)
    entries.push(`T3→T4 (fetch invoice→got PR): ${log.t4_gotInvoice - log.t3_startFetchInvoice}ms`);
  if (log.t5_qrRendered && log.t4_gotInvoice)
    entries.push(`T4→T5 (got PR→QR rendered): ${log.t5_qrRendered - log.t4_gotInvoice}ms`);
  if (log.t5_qrRendered && log.t0_userTap)
    entries.push(`Total (T0→T5): ${log.t5_qrRendered - log.t0_userTap}ms`);
  console.log('[Lightning Timing]', entries.join(' | '));
}

/** Parse BOLT11 invoice to extract expiry timestamp */
export function parseInvoiceExpiry(bolt11: string): number | null {
  // BOLT11 invoices encode timestamp and expiry in the human-readable part
  // Timestamp is encoded after 'lnbc' prefix + amount
  // For simplicity, decode from the tagged fields
  try {
    // The timestamp is the first 35 bits after the hrp separator '1'
    const separatorIdx = bolt11.lastIndexOf('1');
    if (separatorIdx < 0) return null;
    const dataPart = bolt11.substring(separatorIdx + 1);

    // BOLT11 uses bech32 — we decode the 5-bit data characters
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const data5bit: number[] = [];
    for (let i = 0; i < dataPart.length - 6; i++) {
      // last 6 chars are checksum
      const val = CHARSET.indexOf(dataPart[i].toLowerCase());
      if (val < 0) return null;
      data5bit.push(val);
    }

    // First 7 groups of 5 bits = 35 bits = timestamp
    if (data5bit.length < 7) return null;
    let timestamp = 0;
    for (let i = 0; i < 7; i++) {
      timestamp = timestamp * 32 + data5bit[i];
    }

    // Parse tagged fields for expiry (tag 'x' = 6)
    let idx = 7;
    let expiry = 3600; // default 1 hour
    while (idx < data5bit.length) {
      if (idx + 3 > data5bit.length) break;
      const tag = data5bit[idx];
      const dataLength = data5bit[idx + 1] * 32 + data5bit[idx + 2];
      idx += 3;
      if (idx + dataLength > data5bit.length) break;

      if (tag === 6) {
        // expiry tag 'x' = 6 in 5-bit charset index for 'x'
        // Actually tag for expiry: 'x' -> CHARSET.indexOf('x') = 5
        // Let me recalculate: q=0,p=1,z=2,r=3,y=4,9=5,x=6,8=7,g=8,f=9,2=10,t=11,v=12,d=13,w=14,0=15,s=16,3=17,j=18,n=19,5=20,4=21,k=22,h=23,c=24,e=25,6=26,m=27,u=28,a=29,7=30,l=31
        // 'x' = 6 ✓
        let val = 0;
        for (let i = 0; i < dataLength; i++) {
          val = val * 32 + data5bit[idx + i];
        }
        expiry = val;
        break;
      }
      idx += dataLength;
    }

    return (timestamp + expiry) * 1000; // return as ms epoch
  } catch {
    return null;
  }
}

export async function fetchLnurlPayParams(
  lnAddress: string,
  timing?: LnTimingLog
): Promise<LnurlPayResponse> {
  const [user, domain] = lnAddress.split('@');
  if (!user || !domain) {
    throw new Error('Invalid LN Address format');
  }

  if (timing) timing.t1_startFetchLnurl = Date.now();

  const url = `https://${domain}/.well-known/lnurlp/${user}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`LNURL fetch failed: ${res.status}`);
  }

  const data = await res.json();

  if (timing) timing.t2_gotCallback = Date.now();

  if (data.tag !== 'payRequest') {
    throw new Error('Invalid LNURL response: not a payRequest');
  }

  if (!data.callback || typeof data.callback !== 'string') {
    throw new Error('Invalid LNURL response: missing callback URL');
  }

  if (typeof data.minSendable !== 'number' || typeof data.maxSendable !== 'number') {
    throw new Error('Invalid LNURL response: missing min/maxSendable');
  }

  return data as LnurlPayResponse;
}

export async function requestInvoice(
  callbackUrl: string,
  amountMsat: number,
  timing?: LnTimingLog
): Promise<InvoiceResult> {
  if (!callbackUrl) {
    throw new Error('Missing callback URL for invoice request');
  }

  if (timing) timing.t3_startFetchInvoice = Date.now();

  const separator = callbackUrl.includes('?') ? '&' : '?';
  const url = `${callbackUrl}${separator}amount=${amountMsat}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Invoice request failed: ${res.status}`);
  }

  const data: LnurlInvoiceResponse = await res.json();
  if (!data.pr) {
    throw new Error('No invoice returned');
  }

  if (timing) timing.t4_gotInvoice = Date.now();

  return { pr: data.pr, verify: data.verify ?? null };
}

export function pollInvoice(
  checkFn: () => Promise<'pending' | 'settled' | 'expired'>,
  onSettled: () => void,
  onExpired: () => void,
  timeoutMs = 600_000
): () => void {
  const start = Date.now();
  const interval = setInterval(async () => {
    if (Date.now() - start > timeoutMs) {
      clearInterval(interval);
      onExpired();
      return;
    }
    try {
      const status = await checkFn();
      if (status === 'settled') {
        clearInterval(interval);
        onSettled();
      } else if (status === 'expired') {
        clearInterval(interval);
        onExpired();
      }
    } catch {
      // Retry on next interval
    }
  }, 3_000);

  return () => clearInterval(interval);
}

/** Check payment status via verify URL (LNbits / common LNURL pattern) */
export async function checkVerifyUrl(verifyUrl: string): Promise<'pending' | 'settled'> {
  try {
    const res = await fetch(verifyUrl);
    if (!res.ok) return 'pending';
    const data = await res.json();
    // LNbits returns { settled: true/false }
    // Some implementations return { paid: true/false } or { status: "OK" }
    if (data.settled === true || data.paid === true || data.status === 'OK') {
      return 'settled';
    }
    return 'pending';
  } catch {
    return 'pending';
  }
}
