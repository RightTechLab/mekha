import { View, Text, StyleSheet } from "react-native";

interface BalanceCardProps {
  balanceTHB: number;
  bitcoinPrice: number;
}

export default function BalanceCard({
  balanceTHB,
  bitcoinPrice,
}: BalanceCardProps) {
  const balanceSats = balanceTHB / (bitcoinPrice / 100000000);

  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>ยอดเงิน</Text>
      <Text style={styles.balanceAmountTHB}>
        ฿ {balanceTHB.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </Text>
      <Text style={styles.balanceAmountSats}>
        {balanceSats.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
        sats
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    backgroundColor: "#d1ffd1",
    marginTop: 30,
    marginHorizontal: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    backgroundColor: "#f8f8f8",
    fontSize: 18,
    color: "#333",
  },
  balanceAmountTHB: {
    fontSize: 36,
    color: "#333",
    marginTop: 8,
  },
  balanceAmountSats: {
    fontSize: 18,
    color: "#444",
    marginTop: 4,
  },
});
