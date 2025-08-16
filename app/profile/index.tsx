import { Stack } from "expo-router";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";

export default function IndexProfile() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Profile", headerShown: true }} />;
      <Text style={styles.text}>Profile Screen</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 20,
    color: "#000",
  },
});
