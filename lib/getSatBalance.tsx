import { webln } from "@getalby/sdk";

export async function getSatBalance(nwcUrl: string | undefined) {
  try {
    console.log(nwcUrl, "NWC URL from Zustand store");
    
    const nostrWebLn = new webln.NostrWebLNProvider({
      nostrWalletConnectUrl: nwcUrl,
    });
    await nostrWebLn.enable();

    const res = await nostrWebLn.getBalance();

    console.log("Balance fetched successfully:", res.balance);
    return res.balance;
  } catch (error) {
    console.error("Error fetching balance:", error);
    throw error;
  }
}
