import { SafeAreaView, StyleSheet } from "react-native";

import TransactionList from "@/components/index/TransactionList";

export default function TransactionHistory() {
  return (
    <SafeAreaView style={styles.container}>
      <TransactionList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#47a2abc4",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
});
