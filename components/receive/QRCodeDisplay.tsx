import { View, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export default function QRCodeDisplay({
  value,
  size = 280,
}: QRCodeDisplayProps) {
  return (
    <View style={styles.qrContainer}>
      <QRCode size={size} color="black" backgroundColor="white" value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  qrContainer: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 60,
  },
});
