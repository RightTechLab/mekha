import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons';

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


  const [isCopied, setIsCopied] = useState(false);
  const { transaction } = useLocalSearchParams();
  const parsedTransaction: Transaction = JSON.parse(
    Array.isArray(transaction) ? transaction[0] : transaction || "",
  );
  // console.log("Transaction Detail:", parsedTransaction);

  const amount = getAmountFromMemo(parsedTransaction.description);

  const copyInvoiceToClipboard = async () => {
    await Clipboard.setStringAsync(parsedTransaction.invoice);
    setIsCopied(true);
    setTimeout(() => {setIsCopied(false);}, 500);
    };
  


  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>ประเภท</Text>
        <Text>รับชำระเงินผ่านไลต์นิงเน็ตเวิร์ก</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>เวลา</Text>
        <Text>
          {new Date(parsedTransaction.settled_at * 1000).toLocaleDateString(
            "th-TH-u-ca-gregory",
            {
              year: "numeric",
              month: "long",
              day: "numeric",
            },
          )}{" "}
          {new Date(parsedTransaction.settled_at * 1000).toLocaleTimeString(
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

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>มูลค่า</Text>
        <Text>{amount.toFixed(2)} บาท</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>จำนวน</Text>
        <Text>{parsedTransaction.amount.toLocaleString()} ซาโตชิ</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>สถานะ</Text>
        <Text style={{ color: "green" }}>ชำระเงินเสร็จสมบูรณ์</Text>
      </View>


      {/* <View style={{ marginBottom: 20 }}> */}
      {/*   <Text style={{ color: "#6750A4", paddingBottom: 5 }}> */}
      {/*     อินวอยซ์หมดอายุใน */}
      {/*   </Text> */}
      {/*   <Text>{parsedTransaction.amount.toLocaleString()}55 นาที</Text> */}
      {/* </View> */}

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: "#6750A4", paddingBottom: 5 }}>อินวอยซ์</Text>
        <Text>{parsedTransaction.invoice}</Text>
      </View>

      <View
        style={{
          marginBottom: 20,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pressable
          onPress={
            copyInvoiceToClipboard
          }
          style={{
            borderRadius: 14,
            borderWidth: 2,
            borderColor: "#6750A4",
            backgroundColor:isCopied ?"#6750A4":"#fff",
            padding: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {isCopied? 
              <Ionicons 
              name="checkmark" 
              size={24} 
              style={{ paddingRight: 10,color:"#fff" }}
            />
             :
             <Feather
              name="copy"
              size={24}
              style={{ paddingRight: 10,color:"#6750A4" }}
            />
            }
            <Text 
              style={{color :isCopied ?"#fff":"#6750A4"}}
            >
              คัดลอกอินวอยซ์ไปยังคลิปบอร์ด
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  text: {
    fontSize: 16,
  },
});
