import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'DEL'],
];

export default function NumPad({ value, onChange, maxLength = 10 }: NumPadProps) {
  const handlePress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === 'DEL') {
      onChange(value.slice(0, -1));
      return;
    }

    // Prevent multiple decimals
    if (key === '.' && value.includes('.')) return;

    // Prevent leading zeros (allow "0.")
    if (key === '0' && value === '0') return;

    // Limit decimal places to 2
    if (value.includes('.')) {
      const decimals = value.split('.')[1];
      if (decimals && decimals.length >= 2) return;
    }

    if (value.length >= maxLength) return;

    onChange(value + key);
  };

  return (
    <View className="w-full">
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row mb-2">
          {row.map((key) => (
            <Pressable
              key={key}
              className="flex-1 h-14 items-center justify-center mx-1 rounded-xl bg-purple-50 active:bg-purple-100"
              onPress={() => handlePress(key)}
            >
              <Text
                className={`text-lg font-semibold ${
                  key === 'DEL' ? 'text-red-400' : 'text-mekha-text'
                }`}
              >
                {key === 'DEL' ? '⌫' : key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
