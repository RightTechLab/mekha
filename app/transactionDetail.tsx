import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

interface Transaction {
  amount: number;
  state: string;
  payment_hash: string;
  settled_at: number;
  type: string;
  description: string;
  invoice: string;
}

export default function TransactionDetail() {
  const getBitcoinPriceFromMemo = (defaultMemo: string): number => {
    if (!defaultMemo) return NaN;
    const parts = defaultMemo.split(",");
    if (parts.length >= 2) {
      const pricePart = parts[1].trim();
      const price = parseFloat(pricePart.split(" ")[0]);
      console.log("Parsed price from memo:", price);
      return price;
    }
    return NaN;
  };

  const { transaction } = useLocalSearchParams();
  const parsedTransaction: Transaction = JSON.parse(
    Array.isArray(transaction) ? transaction[0] : transaction || "",
  );
  console.log("Transaction Detail:", parsedTransaction);

  const btcPrice = getBitcoinPriceFromMemo(parsedTransaction.description);
  const priceInTHB = (parsedTransaction.amount * btcPrice) / 100_000_000;

  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>ประเภท</Text>
        <Text>รับชำระเงินผ่านไลต์นิงเน็ตเวิร์ก</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>เวลา</Text>
        <Text>
          {new Date(parsedTransaction.settled_at * 1000).toLocaleString()}
        </Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>มูลค่า</Text>
        <Text>{priceInTHB.toFixed(2)} บาท</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>จำนวน</Text>
        <Text>{parsedTransaction.amount.toLocaleString()} ซาโตชิ</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>สถานะ</Text>
        <Text style={{ color: "#B3261E" }}>รอการชำระเงิน</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>
          อินวอยซ์หมดอายุใน
        </Text>
        <Text>{parsedTransaction.amount.toLocaleString()} ซาโตชิ</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>อินวอยซ์หมดอายุใน</Text>
        <Text>{parsedTransaction.amount.toLocaleString()}55 นาที</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>อินวอยซ์</Text>
        <Text>{parsedTransaction.invoice}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  text: {
    fontSize: 16,
  },
});
