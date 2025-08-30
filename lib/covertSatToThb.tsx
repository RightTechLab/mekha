import { getBitcoinPrice } from "./getBitcoinPrice";

export async function covertSatToThb(sats: number) {
  const bitcoinPriceThb = await getBitcoinPrice();
  return sats * (bitcoinPriceThb / 100_000_000);
}
