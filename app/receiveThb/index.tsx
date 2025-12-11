import ActionButton from "@/components/receive/ActionButton";
import { getTransactionList } from "@/lib/getTransactionList";
import { useBalanceStore, useNwcStore } from "@/lib/State/appStore";
import { webln } from "@getalby/sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface TransactionItemProps {
  transaction: webln.Transaction;
  amount: number;
}

function TransactionItem({ transaction, amount }: TransactionItemProps) {
  return (
    <View style={styles.transactionItem}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text style={styles.date}>
            {new Date(transaction.settled_at * 1000).toLocaleDateString(
              "th-TH-u-ca-gregory",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              },
            )}{" "}
            {new Date(transaction.settled_at * 1000).toLocaleTimeString(
              "th-TH",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              },
            )}
          </Text>

          {/* <Text style={styles.amount}> */}
          {/*   {transaction.type === "incoming" ? "+" : "-"} */}
          {/*   {transaction.amount.toLocaleString()} sat */}
          {/* </Text> */}

          {/* NOTE: use for see transaction description  */}
          {/* <Text>{transaction.description}</Text> */}
        </View>
        <View>
          <Text
            style={{
              color: transaction.type === "incoming" ? "green" : "red",
              fontSize: 20,
            }}
          >
            {transaction.type === "incoming" ? "+" : "-"}฿{-amount.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function receiveThb() {
  const nwcUrl = useNwcStore((state) => state.nwcUrl);
  const allThbReceive = useBalanceStore((state) => state.allThbReceive);
  const setAllThbReceive = useBalanceStore((state) => state.setAllThbReceive);

  const [nostrWebLn, setNostrWebLn] =
    useState<webln.NostrWebLNProvider | null>();
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [inputAmount, setInputAmount] = useState<string>("0");
  const [amount, setAmount] = useState<number>(0);
  const [transactions, setTransactions] = useState<webln.Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // const [allThbReceive, setAllThbReceive] = useState<number>(0);

  const fetchTransactions = useCallback(async () => {
    // Don't fetch if nwcUrl is not available yet
    if (!nwcUrl) {
      // console.log("NWC URL not available yet, skipping transaction fetch");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // console.log("Fetching transactions with NWC URL:", nwcUrl);

      const transactionList = await getTransactionList(nwcUrl);
      // console.log("Fetched transactions:", transactionList);
      setTransactions(transactionList);
    } catch (err) {
      console.error("Error fetching transaction list:", err);
      console.log("Failed to fetch transactions. Please try again.", err);
      setError("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [nwcUrl]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]); // Add nwcUrl as dependency

  const getAmountFromMemo = (defaultMemo?: string): number => {
    if (!defaultMemo) return NaN;
    const parts = defaultMemo.split(",");
    if (parts.length >= 1) {
      const pricePart = parts[0].trim(); // <-- amount อยู่ index 0
      const price = parseFloat(pricePart);
      return isNaN(price) ? NaN : price;
    }
    return NaN;
  };

  const filteredTransactions = useMemo(() => {
    const filltered = transactions.filter(
      (item) =>
        item.amount === 1 &&
        item.type === "incoming" &&
        !Number.isNaN(getAmountFromMemo(item.description)),
    );

    const totalThb = filltered.reduce((sum, item) => {
      sum -= getAmountFromMemo(item.description);
      return sum;
    }, 0);

    const updateBalance = () => {
      setAllThbReceive(totalThb);
    };
    updateBalance();

    return filltered;
  }, [transactions, setAllThbReceive]);

  const renderEmptyComponent = () => {
    if (loading) {
      return <Text style={styles.emptyText}>Loading transactions...</Text>;
    }
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (!nwcUrl) {
      return (
        <Text style={styles.emptyText}>Waiting for wallet connection...</Text>
      );
    }
    return <Text style={styles.emptyText}>No transactions found</Text>;
  };

  const handleSetAmount = () => {
    setAmount(parseFloat(inputAmount.replace(/,/g, "")) || 0);
    setIsModalVisible(false);
  };

  const handleDelet = () => {
    setInputAmount((prev) => {
      if (prev.length <= 1) return "0"; // If only one digit or "0", reset to "0"
      return prev.slice(0, -1); // Remove the last character
    });
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

  const onModalOpen = () => {
    setIsModalVisible(true);
  };

  const createNwcClient = async () => {
    try {
      const nostrWebLn = new webln.NostrWebLNProvider({
        nostrWalletConnectUrl: nwcUrl,
      });
      await nostrWebLn.enable();
      setNostrWebLn(nostrWebLn);
      // console.log("WebLN provider initialized with NWC URL:", nostrWebLn);
    } catch (error) {
      console.error("Error creating NWC client:", error);
      throw error;
    }
  };

  const createTransaction1Sat = async () => {
    //  NOTE: create invoice 1 sat
    try {
      const invoice = await nostrWebLn?.makeInvoice({
        amount: 1,
        defaultMemo: `-${amount.toFixed(2)}`,
      });
      const bolt11 = invoice?.paymentRequest.trim();

      //  NOTE: pay invoice 1 sat
      try {
        if (bolt11) {
          await nostrWebLn?.sendPayment(bolt11);
          // console.log("Payment result:", paymentResult);
          await fetchTransactions();
        } else {
          console.error("No bolt11 invoice generated");
        }
      } catch (error) {
        console.error("Error sending payment:", error);
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
    }
  };

  useEffect(() => {
    createNwcClient();
  }, [nwcUrl]);

  useEffect(() => {
    if (amount > 0) {
      createTransaction1Sat();
    }
  }, [amount, nwcUrl]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>ยอดเงินบาทที่ได้รับ</Text>
        <Text style={styles.balanceAmountTHB}>฿ {allThbReceive}</Text>
      </View>

      {/* Trasaction List */}
      <View style={styles.container}>
        <FlatList
          data={filteredTransactions}
          // data={transactions}
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              // amount={getAmountFromMemo(item.description)}
              amount={getAmountFromMemo(item.description)}
            />
          )}
          keyExtractor={(item, index) => `${item.payment_hash}-${index}`}
          style={styles.flatList}
          ListEmptyComponent={renderEmptyComponent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Pressable
        onPress={onModalOpen}
        style={{
          backgroundColor: "#E6CCE9",
          paddingVertical: 18,
          paddingHorizontal: 40,
          borderRadius: 30,
          borderWidth: 2,
          borderColor: "#9575CD",
          bottom: 30,
          marginHorizontal: 20,
        }}
      >
        <Text style={styles.confirmButtonText}>ได้รับเงินบาทแล้ว</Text>
      </Pressable>

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
            <View style={styles.keypad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map(
                (item) => (
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
                ),
              )}
            </View>
            <ActionButton onPress={handleSetAmount} title="Receive Amount" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    marginHorizontal: 20,
  },
  balanceCard: {
    marginTop: 30,
    marginHorizontal: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
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
  button: {
    backgroundColor: "#63509f",
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: Platform.OS === "android" ? 40 : 10,
    marginHorizontal: 20,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 32,
    color: "#fff",
    paddingHorizontal: 10,
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
    marginBottom: 80,
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
    justifyContent: "center",
    marginBottom: 80,
  },
  amountText: {
    color: "#4B3885", // Dark text for light mode
    fontSize: 48,
    marginRight: 10,
  },
  currencyText: {
    color: "#4B3885", // Dark text for light mode
    fontSize: 36,
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
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#ff4444",
  },
  flatList: {
    backgroundColor: "#fff",
  },
  transactionItem: {
    backgroundColor: "#e7ddfd",
    padding: 16,
    marginBottom: 8,
    borderRadius: 10,
  },
  amount: {
    fontSize: 16,
    color: "#333",
    marginTop: 8,
  },
  date: {
    fontSize: 16,
    color: "#4A4459",
  },
  confirmButtonText: {
    fontSize: 18,
    textAlign: "center",
    fontWeight: "600",
    color: "#5E35B1",
  },
});
