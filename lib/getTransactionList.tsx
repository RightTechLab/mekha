import { webln } from "@getalby/sdk";

export async function getTransactionList() {
  try {

    const nwcUrl = process.env.EXPO_PUBLIC_NWC_URL;
    const nostrWebLn = new webln.NostrWebLNProvider({
      nostrWalletConnectUrl: nwcUrl,
    });
    await nostrWebLn.enable();

    const res = await nostrWebLn.listTransactions({
      limit: 100,
      offset: 0,
    });

    console.log("Transaction list fetched successfully:", res.transactions);
    return res.transactions;

  } catch (error) {
    console.error("Error fetching transaction list:", error);
    throw error;
  }
}
