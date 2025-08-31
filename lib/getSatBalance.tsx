import { webln } from "@getalby/sdk";

export async function getSatBalance(nwcUrl: string | undefined) {
  try {
    const nostrWebLn = new webln.NostrWebLNProvider({
      nostrWalletConnectUrl: nwcUrl,
    });
    await nostrWebLn.enable();

    const res = await nostrWebLn.getBalance();

    return res.balance;
  } catch (error) {
    console.error("Error fetching balance:", error);
    throw error;
  }
}
