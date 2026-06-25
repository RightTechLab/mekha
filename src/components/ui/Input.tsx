import { TextInput, View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { DARK_PLACEHOLDER, LIGHT_PLACEHOLDER } from '../../constants/theme';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  autoCapitalize,
}: InputProps) {
  const { colorScheme } = useColorScheme();
  const placeholderColor = colorScheme === 'dark' ? DARK_PLACEHOLDER : LIGHT_PLACEHOLDER;

  return (
    <View className="mb-3">
      {label && (
        <Text className="text-sm font-medium text-mekha-text dark:text-neutral-50 mb-1">{label}</Text>
      )}
      <TextInput
        className="bg-mekha-surface dark:bg-neutral-900 border border-mekha-border dark:border-neutral-800 rounded-xl px-4 py-3 text-mekha-text dark:text-neutral-50"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}
