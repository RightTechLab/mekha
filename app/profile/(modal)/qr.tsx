import QRCode from "react-native-qrcode-svg";
import { Stack } from "expo-router";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";
import { useNwcStore } from "@/lib/State/appStore";

export default function QRCodeScreen() {
  const nwcUrl = useNwcStore((state) => state.nwcUrl);
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "เชื่อมต่อกับ Mekhala Shop เครื่องอื่น",
          headerShown: true,
          headerStyle: { backgroundColor: "#E8DEF8" },
        }}
      />

      <View style={styles.content}>
        <QRCode value={nwcUrl} size={200} />
        <View style={{ marginTop: 40 ,alignItems: "center",justifyContent: "center"}}>
          <Text style={{fontSize:18}}>แสกน QR โค้ดนี้ด้วยแอพ Mekhala Shop</Text>
          <Text style={{fontSize:18}}>บนโทรศัพท์เครื่องอื่นเพื่อใช้รับเงิน</Text>
          <Text style={{fontSize:18}}>ในร้านค้าเดียวกัน</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
