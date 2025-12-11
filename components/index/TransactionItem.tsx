import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { webln } from "@getalby/sdk";
import { SafeAreaView } from "react-native-safe-area-context";

interface TransactionItemProps {
  transaction: webln.Transaction;
  amount: number;
}

export default function TransactionItem({
  transaction,
  amount,
}: TransactionItemProps) {
  const handlePress = () => {
    router.push({
      pathname: "/transactionDetail",
      params: { transaction: JSON.stringify(transaction) },
    });
  };

  return (
    <Pressable onPress={handlePress}>
      <View style={styles.transactionItem}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={styles.date}>
              {new Date(transaction.settled_at * 1000).toLocaleDateString(
                "th-TH-u-ca-gregory",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                },
              )}{" "}
              {new Date(transaction.settled_at * 1000).toLocaleTimeString(
                "th-TH",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                },
              )}
            </Text>

            <Text style={styles.amount}>
              {transaction.type === "incoming" ? "+" : "-"}
              {transaction.amount.toLocaleString()} sat
            </Text>

            {/* NOTE: use for see transaction description  */}
            {/* <Text>{transaction.description}</Text> */}
          </View>
          <View>
            <Text
              style={{
                color: transaction.type === "incoming" ? "green" : "red",
                fontSize: 20,
              }}
            >
              {transaction.type === "incoming" ? "+" : "-"}฿{amount.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  transactionItem: {
    backgroundColor: "#e7ddfd",
    padding: 16,
    marginBottom: 8,
    borderRadius: 10,
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
