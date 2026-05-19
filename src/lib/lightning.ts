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
}

export async function fetchLnurlPayParams(
  lnAddress: string
): Promise<LnurlPayResponse> {
  const [user, domain] = lnAddress.split('@');
  if (!user || !domain) {
    throw new Error('Invalid LN Address format');
  }

  const url = `https://${domain}/.well-known/lnurlp/${user}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`LNURL fetch failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.tag !== 'payRequest') {
    throw new Error('Invalid LNURL response: not a payRequest');
  }

  return data as LnurlPayResponse;
}

export async function requestInvoice(
  callbackUrl: string,
  amountMsat: number
): Promise<string> {
  const url = `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}amount=${amountMsat}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Invoice request failed: ${res.status}`);
  }

  const data: LnurlInvoiceResponse = await res.json();
  if (!data.pr) {
    throw new Error('No invoice returned');
  }

  return data.pr;
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
