import { useBalanceStore } from "@/lib/State/appStore";
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

  const allThbReceive = useBalanceStore((state) => state.allThbReceive);

  const adjustedBalance = balanceTHB - allThbReceive;
  // const adjustedBalanceSats = adjustedBalance / (bitcoinPrice / 100000000);

  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>ยอดเงิน</Text>
      <Text style={styles.balanceAmountTHB}>
        ฿ {adjustedBalance.toFixed(2)}
      </Text>
      <Text style={styles.balanceAmountSats}>
        {balanceSats.toFixed(0)} sats
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    marginTop: 10,
    marginHorizontal: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
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
