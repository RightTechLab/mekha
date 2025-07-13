import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{ headerTintColor: "#63509f", headerShadowVisible: false,headerBackTitle: "Back" }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Home", headerShown: false }}
      />
      <Stack.Screen name="transactionHistory" options={{ headerTitle: "" }} />
    </Stack>
  );
}
