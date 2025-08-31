export async function getBitcoinPrice(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.bitkub.com/api/market/ticker?sym=THB_BTC",
    );
    const data = await response.json();
    return data.THB_BTC.last;
  } catch (error) {
    console.error("Error fetching Bitcoin price:", error);
    throw error;
  }
}
