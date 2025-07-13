import { webln } from "@getalby/sdk";

export async function getSatBalance() {
  try {
    const nwcUrl = process.env.EXPO_PUBLIC_NWC_URL;
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
