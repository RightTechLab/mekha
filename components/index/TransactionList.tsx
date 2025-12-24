import TransactionItem from "@/components/index/TransactionItem";
import { getTransactionList } from "@/lib/getTransactionList";
import { useNwcStore } from "@/lib/State/appStore";
import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { webln } from "@getalby/sdk";

export default function TransactionList() {
  const [transactions, setTransactions] = useState<webln.Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const nwcUrl = useNwcStore((state) => state.nwcUrl);

  useEffect(() => {
    const fetchTransactions = async () => {
      // Don't fetch if nwcUrl is not available yet
      if (!nwcUrl) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const transactionList = await getTransactionList(nwcUrl);
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

  const getAmountFromMemo = (defaultMemo?: string): number => {
    if (!defaultMemo) return NaN;
    const parts = defaultMemo.split(",");
    if (parts.length >= 1) {
      const pricePart = parts[0].trim(); // <-- amount อยู่ index 0
      const price = parseFloat(pricePart);
      return isNaN(price) ? NaN : price;
    }
    return NaN;
  };

  // ฟังก์ชันใช้หา amount ที่จะแสดง (แปลงจาก memo ไม่ได้ -> ใช้ item.amount)
  const getDisplayAmount = (item: webln.Transaction) => {
    const fromMemo = getAmountFromMemo(item.description);
    return Number.isFinite(fromMemo) ? fromMemo : item.amount;
  };

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((item) => {
        return item.amount > 1;
      }),
    [transactions],
  );

  const renderEmptyComponent = () => {
    if (loading) {
      return <Text style={styles.emptyText}>Loading transactions...</Text>;
    }
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (!nwcUrl) {
      return (
        <Text style={styles.emptyText}>Waiting for wallet connection...</Text>
      );
    }
    return <Text style={styles.emptyText}>No transactions found</Text>;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredTransactions}
        // DEBUG: see not filtered transactions
        // data={transactions}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            // amount={getAmountFromMemo(item.description)}
            amount={getDisplayAmount(item)}
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
    borderRadius: 10,
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
