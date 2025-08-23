import {
  View,
  SafeAreaView,
  StyleSheet,
  Modal,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { webln } from "@getalby/sdk";
import { router } from "expo-router";

import { getBitcoinPrice } from "@/lib/getBitcoinPrice";
import Header from "@/components/receive/Header";
import AmountDisplay from "@/components/receive/AmountDisplay";
import QRCodeDisplay from "@/components/receive/QRCodeDisplay";
import ActionButton from "@/components/receive/ActionButton";
import { getNwcUrl } from "@/lib/getNwcUrl";
import { useNwcStore } from "@/lib/State/appStore";

export default function Receive() {
  const [amount, setAmount] = useState<number>(0);
  const [bitcoinPriceThb, setBitcoinPriceThb] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(true);
  const [inputAmount, setInputAmount] = useState<string>("0");

  const [invoice, setInvoice] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState<boolean>(false);
  const nwcUrl = useNwcStore((state) => state.nwcUrl);

  const createInvoice = async () => {
    setLoading(true);
    setError(null);
    setInvoice(null);

    try {
      const nostrWebLn = new webln.NostrWebLNProvider({
        nostrWalletConnectUrl: nwcUrl,
      });
      await nostrWebLn.enable();

      const result = await nostrWebLn.makeInvoice({
        amount: convertThbToSats(amount),
        defaultMemo: `${amount.toFixed(2)}`,
      });
      setInvoice(result.paymentRequest);
      // console.log("Invoice created:", result.paymentRequest);

      // Poll for payment status
      const pollInterval = 2000; // Check every 2 seconds
      const maxAttempts = 30; // Stop after 60 seconds (2s * 30)
      let attempts = 0;

      const checkPaymentStatus = async () => {
        try {
          const payed = await nostrWebLn.lookupInvoice({
            paymentRequest: result.paymentRequest,
          });

          if (payed.paid) {
            // console.log("pay success");
            setPaymentStatus("paid");
            setShowSuccessScreen(true); // Show success screen
            setTimeout(() => {
              setShowSuccessScreen(false); // Hide after 5 seconds
              router.replace("/"); // Navigate to Index page
            }, 3000);
            return true; // Stop polling
          } else {
            // console.log("Invoice not paid yet.");
            setPaymentStatus("pending");
            return false; // Continue polling
          }
        } catch (e: any) {
          console.error("❌ Error checking invoice status:", e);
          setError(e.message || "Error checking payment status");
          return false; // Continue polling on error
        }
      };

      if (await checkPaymentStatus()) return; // If paid, stop polling

      // Start polling
      const interval = setInterval(async () => {
        attempts++;
        if (await checkPaymentStatus()) {
          clearInterval(interval); // Stop polling if paid
        } else if (attempts >= maxAttempts) {
          clearInterval(interval); // Stop polling after max attempts
          // console.log("Stopped polling: Maximum attempts reached.");
          setPaymentStatus("timeout");
          setError("Payment check timed out.");
        }
      }, pollInterval);
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      setError(error.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getBitcoinPrice()
      .then(setBitcoinPriceThb)
      .catch((error) => {
        console.error("Error fetching Bitcoin price:", error);
        setBitcoinPriceThb(0);
      })
      .finally(() => setIsLoading(false));
    createInvoice();
  }, [amount, nwcUrl]);

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
    // console.log("Pressed:", number, "Type:", typeof number); // Debug log
    setInputAmount((prev) => {
      // console.log("Previous:", prev, "Adding:", number); // Debug log

      if (number === "." && prev.includes(".")) {
        // console.log("Decimal already exists, skipping");
        return prev;
      }

      if (prev.includes(".") && number !== ".") {
        const decimalPart = prev.split(".")[1];
        if (decimalPart && decimalPart.length >= 2) {
          // console.log("Max decimal places reached");
          return prev;
        }
      }

      if (prev === "0" && number !== ".") {
        // console.log("Replacing 0 with", number);
        return number;
      }

      const newValue = prev + number;
      // console.log("New value:", newValue);
      return newValue;
    });
  };

  const handleDelet = () => {
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
    if (!value || value === "") return "0";

    const cleanValue = value.replace(/,/g, "");

    // Split by decimal point
    const parts = cleanValue.split(".");
    const integerPart = parts[0] || "0";
    const decimalPart = parts[1];

    // Format integer part with commas
    const formattedInteger = parseInt(integerPart).toLocaleString("en-US");

    // Reconstruct the number
    if (parts.length === 1) {
      return formattedInteger;
    } else if (decimalPart === undefined || decimalPart === "") {
      // User typed "1." - show "1."
      return formattedInteger + ".";
    } else {
      // User typed "1.23" - show "1.23"
      return formattedInteger + "." + decimalPart;
    }
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

        {loading && !invoice && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4B3885" />
            <Text style={styles.loadingText}>Generating QR Code...</Text>
          </View>
        )}

        {invoice && <QRCodeDisplay value={invoice} />}

        <ActionButton onPress={handleAmountChange} title={getButtonTitle()} />

        {showSuccessScreen && (
          <View style={styles.successOverlay}>
            <Text style={styles.successText}>การชำระเงินสำเร็จ!</Text>
            <View style={styles.checkCircle}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
            <Text style={styles.amountText}>
              ฿{formatWithCommas(amount.toString())}
            </Text>
            <Text style={styles.satsText}>
              {convertThbToSats(amount).toLocaleString()} sats
            </Text>
            <Text style={styles.thankYouText}>ขอบคุณสำหรับการชำระเงิน</Text>
          </View>
        )}

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
                <Pressable onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.closeButton}>×</Text>
                </Pressable>
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
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  ".",
                  "0",
                  "⌫",
                ].map((item) => (
                  <Pressable
                    key={item}
                    style={styles.key}
                    onPress={() => {
                      if (item === "⌫") {
                        handleDelet();
                      } else {
                        handleNumberPress(item); // Now item is already a string
                      }
                    }}
                  >
                    <Text style={styles.keyText}>{item}</Text>
                  </Pressable>
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
    height: "90%",
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
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgb(107, 70, 193)", // Semi-transparent purple
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  successText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  checkMark: {
    color: "#6B46C1",
    fontSize: 40,
    fontWeight: "bold",
  },
  satsText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 10,
  },
  thankYouText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 20,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    marginTop: 100,
  },
  loadingText: {
    color: "#4B3885",
    fontSize: 16,
    marginTop: 10,
  },
});
