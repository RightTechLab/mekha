import { FlatList, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { getTransactionList } from "@/lib/getTransactionList";
import TransactionItem from "@/components/index/TransactionItem";
import { useNwcStore } from "@/lib/State/appStore";

interface Transaction {
  amount: number;
  state: string;
  payment_hash: string;
  settled_at: number;
  type: string;
  description: string;
  invoice: string;
}

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const nwcUrl = useNwcStore((state) => state.nwcUrl);

  useEffect(() => {
    const fetchTransactions = async () => {
      // Don't fetch if nwcUrl is not available yet
      if (!nwcUrl) {
        console.log("NWC URL not available yet, skipping transaction fetch");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log("Fetching transactions with NWC URL:", nwcUrl);
        
        const transactionList = await getTransactionList(nwcUrl);
        console.log("Fetched transactions:", transactionList);
        setTransactions(transactionList);
      } catch (err) {
        console.error("Error fetching transaction list:", err);
        console.log("Failed to fetch transactions. Please try again.", err);
        setError("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [nwcUrl]); // Add nwcUrl as dependency

  const getBitcoinPriceFromMemo = (defaultMemo?: string): number => {
    if (!defaultMemo) return NaN;
    const parts = defaultMemo.split(",");
    if (parts.length >= 2) {
      const pricePart = parts[1].trim();
      const price = parseFloat(pricePart.split(" ")[0]);
      return price;
    }
    return NaN;
  };

  const renderEmptyComponent = () => {
    if (loading) {
      return <Text style={styles.emptyText}>Loading transactions...</Text>;
    }
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (!nwcUrl) {
      return <Text style={styles.emptyText}>Waiting for wallet connection...</Text>;
    }
    return <Text style={styles.emptyText}>No transactions found</Text>;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            bitcoinPrice={getBitcoinPriceFromMemo(item.description)}
          />
        )}
        keyExtractor={(item, index) => `${item.payment_hash}-${index}`}
        style={styles.flatList}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 20,
  },
  flatList: {
    backgroundColor: "#fff",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#ff4444",
  },
});
