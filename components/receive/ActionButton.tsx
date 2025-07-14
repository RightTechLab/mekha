import { Text, Pressable, StyleSheet } from "react-native";

interface ActionButtonProps {
  onPress: () => void;
  title: string;
}

export default function ActionButton({ onPress, title }: ActionButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.confirmButton}>
      <Text style={styles.confirmButtonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  confirmButton: {
    backgroundColor: "#E6CCE9",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#9575CD",
    width: "90%",
    position: "absolute",
    bottom: 50,
  },
  confirmButtonText: {
    fontSize: 18,
    textAlign: "center",
    fontWeight: "600",
    color: "#5E35B1",
  },
});
