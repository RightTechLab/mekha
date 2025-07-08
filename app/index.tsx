import { View, SafeAreaView, StyleSheet } from "react-native";
import HeaderIcon from "@/components/HeaderIcon";
import { useEffect, useState } from "react";
import BalanceCard from "@/components/BalanceCard";
import { getBitcoinPrice } from "@/lib/getBitcoinPrice";

export default function Index() {
  const [balanceTHB, setBalanceTHB] = useState<number>(100);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await getBitcoinPrice();
        setBitcoinPrice(price);
      } catch (error) {
        console.error("Error fetching Bitcoin price:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // Update every minute
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderIcon />
      <BalanceCard balanceTHB={balanceTHB} bitcoinPrice={bitcoinPrice} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffc3c3",
  },
});
