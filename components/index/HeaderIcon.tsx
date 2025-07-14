import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export default function HeaderIcon() {
  return (
    <View style={styles.header}>
      {/* TODO: impiment onPress anoter */}
      <Pressable onPress={() => console.log("Menu Pressed")}>
        <Ionicons name="person-circle-outline" size={32} color="#4B3885" />
      </Pressable>

      {/* TODO: impiment onPress anoter */}
      <Pressable onPress={() => console.log("Logo Pressed")}>
        <MaterialIcons name="menu" size={32} color="#000" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginTop: Platform.OS === "android" ? 20 : 0,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
