import { TextInput, View, Text } from 'react-native';

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
  return (
    <View className="mb-3">
      {label && (
        <Text className="text-sm font-medium text-mekha-text mb-1">{label}</Text>
      )}
      <TextInput
        className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 text-mekha-text"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}
