import { View, SafeAreaView, StyleSheet, Text } from "react-native";
import HeaderIcon from "@/components/HeaderIcon";
import { useEffect, useState } from "react";

export default function Index() {
  const [balanceTHB, setBalanceTHB] = useState<number>(12);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);

  const balanceSats = balanceTHB / (bitcoinPrice / 100000000);

  useEffect(() => {
    const fetBitcoinPrice = async () => {
      try {
        const response = await fetch(
          "https://api.bitkub.com/api/market/ticker?sym=THB_BTC",
        );
        const data = await response.json();
        const bitcoinPrice = data.THB_BTC.last;
        setBitcoinPrice(bitcoinPrice);
      } catch (error) {
        console.error("Error fetching Bitcoin price:", error);
      }
    };

    fetBitcoinPrice();
    const interval = setInterval(fetBitcoinPrice, 60000); // Update every minute
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderIcon />

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>ยอดเงิน</Text>
        <Text style={styles.balanceAmountTHB}>
          ฿ {balanceTHB.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
        <Text style={styles.balanceAmountSats}>
          {balanceSats.toLocaleString(undefined, { minimumFractionDigits: 2 })} sats
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffc3c3",
  },
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
