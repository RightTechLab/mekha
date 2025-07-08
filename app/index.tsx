import { View, SafeAreaView, StyleSheet } from "react-native";
import HeaderIcon from "@/components/HeaderIcon";

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <HeaderIcon />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffc3c3",
  },
});
