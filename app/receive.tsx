import { View, SafeAreaView, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import { getBitcoinPrice } from "@/lib/getBitcoinPrice";
import Header from "@/components/receive/Header";
import AmountDisplay from "@/components/receive/AmountDisplay";
import QRCodeDisplay from "@/components/receive/QRCodeDisplay";
import ActionButton from "@/components/receive/ActionButton";

export default function Receive() {
  const [amount, setAmount] = useState<number>(0);
  const [bitcoinPriceThb, setBitcoinPriceThb] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch Bitcoin price once when component mounts
  useEffect(() => {
    getBitcoinPrice()
      .then(setBitcoinPriceThb)
      .catch((error) => {
        console.error("Error fetching Bitcoin price:", error);
        setBitcoinPriceThb(0);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const convertThbToSats = (thb: number): number => {
    if (bitcoinPriceThb === 0) return 0;
    return Math.round((thb / bitcoinPriceThb) * 100_000_000);
  };

  const handleAmountChange = () => {
    setAmount(amount + 100);
  };

  const getButtonTitle = () => {
    return amount === 0 ? "ระบุยอดเงิน" : "แก้ไขยอดเงิน";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <Header title="Bitcoin Lightning Network" />

        <AmountDisplay
          amount={amount}
          satsAmount={convertThbToSats(amount)}
          isLoading={isLoading}
        />

        <QRCodeDisplay value="https://example.com" />

        <ActionButton onPress={handleAmountChange} title={getButtonTitle()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  innerContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
  },
});
