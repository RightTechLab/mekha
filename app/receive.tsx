import {
  View,
  SafeAreaView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
} from "react-native";
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
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [inputAmount, setInputAmount] = useState<string>("0");

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
    setIsModalVisible(true);
  };

  const getButtonTitle = () => {
    return amount === 0 ? "ระบุยอดเงิน" : "แก้ไขยอดเงิน";
  };

  const handleNumberPress = (number: string) => {
    setInputAmount((prev) => {
      if (prev === "0" && number !== ".") return number;
      return prev + number;
    });
  };

  const handleClear = () => {
    setInputAmount((prev) => {
      if (prev.length <= 1) return "0"; // If only one digit or "0", reset to "0"
      return prev.slice(0, -1); // Remove the last character
    });
  };

  const handleSetAmount = () => {
    setAmount(parseFloat(inputAmount.replace(/,/g, "")) || 0);
    setIsModalVisible(false);
  };

  const formatWithCommas = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ""));
    if (isNaN(num)) return "0";
    return num.toLocaleString("en-US");
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

        <Modal
          visible={isModalVisible}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enter Amount</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountText}>
                  ฿ {formatWithCommas(inputAmount)}
                </Text>
                <Text style={styles.currencyText}>THB</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.amountRow}>
                <Text style={styles.amountText}>
                  {formatWithCommas(
                    convertThbToSats(
                      parseFloat(inputAmount.replace(/,/g, "")),
                    ).toString(),
                  ) || "0"}
                </Text>
                <Text style={styles.currencyText}>SAT</Text>
              </View>
              <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "⌫"].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.key}
                    onPress={() =>
                      item === "⌫"
                        ? handleClear()
                        : handleNumberPress(item.toString())
                    }
                  >
                    <Text style={styles.keyText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ActionButton onPress={handleSetAmount} title="Set Amount" />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff", // Light mode background
  },
  innerContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#ffffff", // Light mode background
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#ffffff", // Light mode content background
    width: "100%",
    height: "100%",
    borderRadius: 0,
    padding: 20,
    alignItems: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#4B3885", // Dark text for light mode
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    color: "#4B3885", // Adjusted orange for light mode
    fontSize: 20,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  amountText: {
    color: "#4B3885", // Dark text for light mode
    fontSize: 24,
    marginRight: 10,
  },
  currencyText: {
    color: "#4B3885", // Dark text for light mode
    fontSize: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#4B3885", // Adjusted orange divider
    width: "100%",
    marginVertical: 10,
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
  },
  key: {
    width: "33.33%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff", // Light key background
  },
  keyText: {
    color: "#4B3885", // Dark text for keys
    fontSize: 24,
  },
});
