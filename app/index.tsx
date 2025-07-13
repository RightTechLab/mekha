import { Pressable, SafeAreaView, StyleSheet, Text } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";

import HeaderIcon from "@/components/HeaderIcon";
import BalanceCard from "@/components/BalanceCard";
import TransactionList from "@/components/TransactionList";
import { getBitcoinPrice } from "@/lib/getBitcoinPrice";
import ReceiveIcon from "@/components/ReceiveIcon";

export default function Index() {
  const [balanceTHB, setBalanceTHB] = useState<number>(100);
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
      <HeaderIcon />
      <BalanceCard balanceTHB={balanceTHB} bitcoinPrice={bitcoinPrice} />
      <TransactionList bitcoinPrice={bitcoinPrice} />
      <Pressable
        onPress={() => router.push("/transactionHistory")}
        style={styles.transactionButton}
      >
        <Text style={styles.transactionText}>ดูประวัติธุรกรรมทั้งหมด</Text>
      </Pressable>
      <ReceiveIcon />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffc3c3",
  },
  transactionButton: {
    backgroundColor: "#47a2abc4",
    alignItems: "center",
    marginTop: 40,
    marginHorizontal: 20,
  },
  transactionText: {
    color: "#fff",
    fontSize: 16,
  },
});
