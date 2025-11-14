import { StyleSheet, Text, View } from "react-native";

interface AmountDisplayProps {
  amount: number;
  satsAmount: number;
  isLoading: boolean;
}

export default function AmountDisplay({
  amount,
  satsAmount,
  isLoading,
}: AmountDisplayProps) {
  const formatWithCommas = (value: number): string => {
    return value.toLocaleString("en-US");
  };

  return (
    <View style={styles.amountContainer}>
      {amount === 0 ? (
        <Text style={styles.noAmount}>ไม่ระบุยอดเงิน</Text>
      ) : (
        <>
          <Text style={styles.amount}>฿{formatWithCommas(amount)}</Text>
          <Text style={styles.sats}>
            {isLoading ? "Loading..." : `${formatWithCommas(satsAmount)} sats`}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  amountContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  amount: {
    fontSize: 48,
    color: "#000",
    fontWeight: "300",
    marginBottom: 5,
  },
  sats: {
    fontSize: 18,
    color: "#666",
    fontWeight: "400",
  },
  noAmount: {
    fontSize: 24,
    color: "#666",
    fontWeight: "400",
  },
});
