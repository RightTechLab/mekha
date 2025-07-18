import { View, Text, StyleSheet } from "react-native";

interface Transaction {
  amount: number;
  state: string;
  payment_hash: string;
  settled_at: number;
  type: string;
  description: string;
}

interface TransactionItemProps {
  transaction: Transaction;
  bitcoinPrice: number;
}

export default function TransactionItem({
  transaction,
  bitcoinPrice,
}: TransactionItemProps) {
  const sats = transaction.amount;
  const thb = (sats * bitcoinPrice) / 100_000_000;

  return (
    <View style={styles.transactionItem}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" ,alignItems: "center" }}>
        <View>
          <Text style={styles.date}>
            {new Date(transaction.settled_at * 1000).toLocaleString()}
          </Text>
          
          <Text style={styles.amount}>
            {transaction.type === "incoming" ? "+" : "-"}{transaction.amount.toLocaleString()} sat
          </Text>
          {/* DEBUG: use for see transaction description  */}
          <Text>{transaction.description}</Text>
        </View>
        <View>
          <Text>
            <Text
              style={{
                color: transaction.type === "incoming" ? "green" : "red",
                fontSize: 20,
              }}
            >
              {transaction.type === "incoming" ? "+" : "-"}฿{thb.toFixed(2)}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  transactionItem: {
    backgroundColor: "#e7ddfd",
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  amount: {
    fontSize: 16,
    color: "#333",
    marginTop: 8,
  },
  date: {
    fontSize: 16,
    color: "#4A4459",
  },
});
