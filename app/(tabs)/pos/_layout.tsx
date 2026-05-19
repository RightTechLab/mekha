import { Stack } from 'expo-router';

export default function PosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="checkout"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  );
}
