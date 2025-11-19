import { StyleSheet, Text, View } from "react-native";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <View style={styles.titleContainer}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    color: "#000",
    fontWeight: "400",
  },
});
