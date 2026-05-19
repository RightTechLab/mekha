import { Pressable, Text, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

const VARIANT_STYLES = {
  primary: 'bg-purple-600 active:bg-purple-700',
  secondary: 'bg-purple-50 active:bg-purple-100',
  danger: 'bg-red-50 active:bg-red-100 border border-red-700',
  ghost: 'bg-transparent',
};

const VARIANT_TEXT = {
  primary: 'text-white',
  secondary: 'text-purple-700',
  danger: 'text-red-700',
  ghost: 'text-mekha-muted',
};

const SIZE_STYLES = {
  sm: 'py-2 px-3 rounded-xl',
  md: 'py-3 px-4 rounded-2xl',
  lg: 'py-4 px-6 rounded-2xl',
};

const SIZE_TEXT = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      className={`items-center justify-center ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${
        disabled ? 'opacity-50' : ''
      }`}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#7C3AED'} />
      ) : (
        <Text className={`font-semibold ${VARIANT_TEXT[variant]} ${SIZE_TEXT[size]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
