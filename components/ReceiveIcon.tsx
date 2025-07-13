import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import { Octicons } from "@expo/vector-icons";

export default function ReceiveIcon() {
  return (
    <Pressable style={styles.button}>
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
    marginBottom: 20,
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
