import { useState, useCallback } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useSessionStore } from '../../src/features/auth/sessionStore';

const PIN_LENGTH = 6;

export default function PinScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { setRole, setAuthenticated } = useSessionStore();

  const handlePress = useCallback(
    async (digit: string) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + digit;
      setError('');

      if (newPin.length === PIN_LENGTH) {
        // Hash the PIN and compare
        const ownerHash = await SecureStore.getItemAsync('mekha.owner_pin_hash');
        const cashierHash = await SecureStore.getItemAsync('mekha.cashier_pin_hash');

        // Simple hash comparison using built-in
        const inputHash = await hashPin(newPin);

        if (!ownerHash && !cashierHash) {
          // First time setup — set as owner
          await SecureStore.setItemAsync('mekha.owner_pin_hash', inputHash);
          setRole('owner');
          setAuthenticated(true);
          router.replace('/(tabs)/pos');
          return;
        }

        if (inputHash === ownerHash) {
          setRole('owner');
          setAuthenticated(true);
          router.replace('/(tabs)/pos');
        } else if (inputHash === cashierHash) {
          setRole('cashier');
          setAuthenticated(true);
          router.replace('/(tabs)/pos');
        } else {
          setError('PIN ไม่ถูกต้อง');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPin('');
        }
      } else {
        setPin(newPin);
      }
    },
    [pin, setRole, setAuthenticated]
  );

  const handleDelete = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError('');
  }, []);

  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <Image
        source={require('../../assets/logo.jpg')}
        className="w-20 h-20 rounded-2xl mb-3"
        resizeMode="contain"
      />
      <Text className="text-3xl font-bold text-purple-600 mb-2">Mekha</Text>
      <Text className="text-mekha-muted mb-8">กรุณาใส่ PIN</Text>

      {/* PIN dots */}
      <View className="flex-row gap-4 mb-8">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            className={`w-4 h-4 rounded-full ${
              i < pin.length ? 'bg-purple-600' : 'bg-purple-100'
            }`}
          />
        ))}
      </View>

      {error ? (
        <Text className="text-red-700 mb-4">{error}</Text>
      ) : null}

      {/* NumPad */}
      <View className="w-full max-w-[280px]">
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['', '0', 'DEL'],
        ].map((row, rowIdx) => (
          <View key={rowIdx} className="flex-row justify-center mb-3">
            {row.map((key) => (
              <Pressable
                key={key || 'empty'}
                className={`w-20 h-16 items-center justify-center mx-2 rounded-2xl ${
                  key === ''
                    ? ''
                    : key === 'DEL'
                    ? 'bg-purple-50'
                    : 'bg-purple-50 active:bg-purple-100'
                }`}
                onPress={() => {
                  if (key === 'DEL') handleDelete();
                  else if (key !== '') handlePress(key);
                }}
                disabled={key === ''}
              >
                <Text
                  className={`text-xl font-semibold ${
                    key === 'DEL' ? 'text-purple-700 text-base' : 'text-mekha-text'
                  }`}
                >
                  {key}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* Dev reset */}
      <Pressable
        className="mt-8"
        onLongPress={async () => {
          await SecureStore.deleteItemAsync('mekha.owner_pin_hash');
          await SecureStore.deleteItemAsync('mekha.cashier_pin_hash');
          setPin('');
          setError('รีเซ็ต PIN แล้ว — ตั้งใหม่ได้เลย');
        }}
      >
        <Text className="text-purple-300 text-sm">กดค้างเพื่อรีเซ็ต PIN</Text>
      </Pressable>
    </View>
  );
}

async function hashPin(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + 'mekha_salt'
  );
}
