import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: "#63509f",
        headerShadowVisible: false,
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Home", headerShown: false }}
      />
      <Stack.Screen name="transactionHistory" options={{ headerTitle: "" }} />
      <Stack.Screen
        name="receive"
        options={{ animation: "slide_from_bottom" }}
      />

      <Stack.Screen
        name="scanner/index"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: "#E8DEF8" },
          title: "แสกน QR เชื่อมต่อ nwc",
        }}
      />
      <Stack.Screen
        name="profile/edit"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: "#E8DEF8" },
          title: "แก้ไขข้อมูลติดต่อ",
        }}
      />
      <Stack.Screen
        name="transactionDetail"
        options={{
          headerShown: true,
          title: "",
        }}
      />
    </Stack>
  );
}
