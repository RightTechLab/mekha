import ActionButton from "@/components/receive/ActionButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { getTransactionList } from "@/lib/getTransactionList";
import { useBalanceStore, useNwcStore } from "@/lib/State/appStore";
import { webln } from "@getalby/sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface TransactionItemProps {
  transaction: webln.Transaction;
  amount: number;
}

function TransactionItem({ transaction, amount }: TransactionItemProps) {
  const displayAmount = Math.abs(amount).toFixed(2);

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
        </View>
        <View>
          <Text
            style={{
              // สีเขียวเสมอเพราะหน้านี้คือ Receive (ได้รับเงินบาท)
              color: "green",
              fontSize: 20,
            }}
          >
            +฿{displayAmount}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ReceiveThb() {
  const nwcUrl = useNwcStore((state) => state.nwcUrl);
  const allThbReceive = useBalanceStore((state) => state.allThbReceive);
  const setAllThbReceive = useBalanceStore((state) => state.setAllThbReceive);

  const [nostrWebLn, setNostrWebLn] = useState<webln.NostrWebLNProvider | null>(
    null,
  );
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [inputAmount, setInputAmount] = useState<string>("0");

  const [transactions, setTransactions] = useState<webln.Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessingPayment, setIsProcessingPayment] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Setup NWC Connection
  useEffect(() => {
    const initNwc = async () => {
      if (nwcUrl) {
        try {
          const provider = new webln.NostrWebLNProvider({
            nostrWalletConnectUrl: nwcUrl,
          });
          await provider.enable();
          setNostrWebLn(provider);
        } catch (error) {
          console.error("Error creating NWC client:", error);
        }
      }
    };
    initNwc();
  }, [nwcUrl]);

  // 2. Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    if (!nwcUrl) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const transactionList = await getTransactionList(nwcUrl);
      setTransactions(transactionList);
    } catch (err) {
      console.error("Error fetching transaction list:", err);
      setError("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [nwcUrl]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Helper Functions
  const getAmountFromMemo = (defaultMemo?: string): number => {
    if (!defaultMemo) return NaN;
    const parts = defaultMemo.split(",");
    const pricePart = parts[0].trim();
    const price = parseFloat(pricePart);
    return isNaN(price) ? NaN : price;
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(
      (item) =>
        item.amount === 1 &&
        item.type === "incoming" &&
        !Number.isNaN(getAmountFromMemo(item.description)),
    );
  }, [transactions]);

  useEffect(() => {
    const totalThb = filteredTransactions.reduce((sum, item) => {
      sum += Math.abs(getAmountFromMemo(item.description));
      return sum;
    }, 0);
    setAllThbReceive(totalThb);
  }, [filteredTransactions, setAllThbReceive]);

  const handleConfirmTransaction = async () => {
    const thbAmount = parseFloat(inputAmount.replace(/,/g, ""));

    if (!thbAmount || thbAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (!nostrWebLn) {
      Alert.alert("Error", "Wallet not connected");
      return;
    }

    try {
      setIsProcessingPayment(true);

      // A. สร้าง Invoice 1 sat โดยใส่ Memo เป็นค่าเงินบาท (ติดลบเพื่อให้รู้ว่าเป็นรายการรับ หรือตาม format เดิม)
      // Memo: "-100.50"
      const invoice = await nostrWebLn.makeInvoice({
        amount: 1,
        defaultMemo: `-${thbAmount.toFixed(2)}`,
      });

      const bolt11 = invoice?.paymentRequest;

      // B. จ่าย Invoice ทันที (Self-payment เพื่อบันทึกลง Ledger)
      if (bolt11) {
        await nostrWebLn.sendPayment(bolt11);

        // C. จ่ายเสร็จแล้ว -> รีเฟรชรายการ
        await fetchTransactions();

        // D. Reset และปิด Modal
        setInputAmount("0");
        setIsModalVisible(false);
      } else {
        Alert.alert("Error", "Failed to generate invoice");
      }
    } catch (error) {
      console.error("Payment failed:", error);
      Alert.alert("Error", "Transaction failed. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // UI Handlers
  const handleDelet = () => {
    setInputAmount((prev) => {
      if (prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  };

  const handleNumberPress = (number: string) => {
    setInputAmount((prev) => {
      if (number === "." && prev.includes(".")) return prev;
      if (prev.includes(".") && number !== ".") {
        const decimalPart = prev.split(".")[1];
        if (decimalPart && decimalPart.length >= 2) return prev;
      }
      if (prev === "0" && number !== ".") return number;
      return prev + number;
    });
  };

  const formatWithCommas = (value: string): string => {
    if (!value) return "0";
    const cleanValue = value.replace(/,/g, "");
    const parts = cleanValue.split(".");
    const integerPart = parts[0] || "0";
    const decimalPart = parts[1];
    const formattedInteger = parseInt(integerPart).toLocaleString("en-US");

    if (parts.length === 1) return formattedInteger;
    return formattedInteger + "." + (decimalPart || "");
  };

  const renderEmptyComponent = () => {
    if (loading)
      return <Text style={styles.emptyText}>Loading transactions...</Text>;
    if (error) return <Text style={styles.errorText}>{error}</Text>;
    if (!nwcUrl)
      return (
        <Text style={styles.emptyText}>Waiting for wallet connection...</Text>
      );
    return <Text style={styles.emptyText}>No transactions found</Text>;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>ยอดเงินบาทที่ได้รับ</Text>
        <Text style={styles.balanceAmountTHB}>
          ฿{" "}
          {allThbReceive.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>

      <View style={styles.container}>
        <FlatList
          data={filteredTransactions}
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              amount={getAmountFromMemo(item.description)}
            />
          )}
          keyExtractor={(item) => item.payment_hash}
          style={styles.flatList}
          ListEmptyComponent={renderEmptyComponent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchTransactions}
        />
      </View>

      <Pressable
        onPress={() => setIsModalVisible(true)}
        style={styles.mainButton} // แยก Style ออกมาให้ชัดเจน
      >
        <Text style={styles.confirmButtonText}>ได้รับเงินบาทแล้ว</Text>
      </Pressable>

      <Modal
        visible={isModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => !isProcessingPayment && setIsModalVisible(false)} // ห้ามปิดตอนกำลังโหลด
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Amount</Text>
              {!isProcessingPayment && (
                <Pressable onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.closeButton}>×</Text>
                </Pressable>
              )}
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
                    disabled={isProcessingPayment}
                    onPress={() => {
                      if (item === "⌫") handleDelet();
                      else handleNumberPress(item);
                    }}
                  >
                    <Text style={styles.keyText}>{item}</Text>
                  </Pressable>
                ),
              )}
            </View>

            {/* Action Button Section */}
            <View style={{ width: "100%" }}>
              {isProcessingPayment ? (
                <View style={styles.processingButton}>
                  <View style={{flexDirection:"row"}}>
                    <ActivityIndicator color={"#5E35B1"} />
                    <Text style={styles.confirmButtonText}>Processing...</Text>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleConfirmTransaction}
                  style={styles.ConfirmButton}
                >
                  <Text style={styles.confirmButtonText}>Confirm Receive</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0)",
    marginHorizontal: 40,
    marginBottom: 40,
  },
  balanceCard: {
    marginTop: 0,
    marginHorizontal: 20,
    padding: 9,
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
    marginBottom: 20,
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
    paddingLeft: 16,
    paddingRight: 32,
    paddingVertical: 16,
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
  mainButton: {
    backgroundColor: "#E6CCE9",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#9575CD",
    marginBottom: 30,
    marginHorizontal: 20,
    alignItems: "center",
  },
  ConfirmButton: {
    backgroundColor: "#E6CCE9",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#9575CD",
    marginBottom: 30,
    marginHorizontal: 20,
    alignItems: "center",
  },

  processingButton: {
    backgroundColor: "#E6CCE9",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#9575CD",
    marginBottom: 30,
    marginHorizontal: 20,
    alignItems: "center",
  },
});
