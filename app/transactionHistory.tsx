import { Pressable, SafeAreaView, StyleSheet, Text } from "react-native";
import { useEffect, useState } from "react";

import TransactionList from "@/components/TransactionList";
import { getBitcoinPrice } from "@/lib/getBitcoinPrice";

export default function TransactionHistory() {
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);

  useEffect(() => {
    const fetchBtcPrice = async () => {
      try {
        const btcPrice = await getBitcoinPrice();
        setBitcoinPrice(btcPrice);
      } catch (error) {
        console.error("Error fetching Bitcoin price:", error);
      }
    };

    fetchBtcPrice();
    const interval = setInterval(fetchBtcPrice, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
        <TransactionList bitcoinPrice={bitcoinPrice}/>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#47a2abc4",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
});
