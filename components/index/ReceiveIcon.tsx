import { Octicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

export default function ReceiveIcon() {
  return (
    <Pressable style={styles.button} onPress={() => router.push("/receive")}>
      <Octicons name="download" size={32} color="#fff" />
      <Text style={styles.text}>รับเงิน</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
