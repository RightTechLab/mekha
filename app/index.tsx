import { Pressable, SafeAreaView, StyleSheet, Text } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";

import HeaderIcon from "@/components/index/HeaderIcon";
import BalanceCard from "@/components/index/BalanceCard";
import TransactionList from "@/components/index/TransactionList";
import { getBitcoinPrice } from "@/lib/getBitcoinPrice";
import ReceiveIcon from "@/components/index/ReceiveIcon";
import { getSatBalance } from "@/lib/getSatBalance";
import { covertSatToThb } from "@/lib/covertSatToThb";

export default function Index() {
  const [balanceTHB, setBalanceTHB] = useState<number>(0);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);
  const [satBalance, setSatBalance] = useState<number>(0);

  useEffect(() => {
    const fetSatBalance = async () => {
      try {
        const balance = await getSatBalance();
        setSatBalance(balance);
        const thbBalance = await covertSatToThb(balance);
        setBalanceTHB(thbBalance);
      } catch (error) {
        console.error("Error fetching satoshi balance:", error);
      }
    };
    const fetchBtcPrice = async () => {
      try {
        const btcPrice = await getBitcoinPrice();
        setBitcoinPrice(btcPrice);
      } catch (error) {
        console.error("Error fetching Bitcoin price:", error);
      }
    };

    fetchBtcPrice();
    fetSatBalance();
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
    // backgroundColor: "#ffc3c3",
    backgroundColor: "#fff",
  },
  transactionButton: {
    // backgroundColor: "#47a2abc4",
    backgroundColor: "#fff",
    alignItems: "center",
    marginTop: 40,
    marginHorizontal: 20,
  },
  transactionText: {
    color: "#000",
    fontSize: 16,
    marginBottom: 20,
  },
});
