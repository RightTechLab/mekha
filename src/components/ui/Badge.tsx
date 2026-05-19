import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'purple' | 'green' | 'red' | 'yellow' | 'gray';
}

const BADGE_STYLES = {
  purple: 'bg-purple-50',
  green: 'bg-green-50',
  red: 'bg-red-50',
  yellow: 'bg-yellow-50',
  gray: 'bg-gray-100',
};

const BADGE_TEXT = {
  purple: 'text-purple-700',
  green: 'text-green-700',
  red: 'text-red-700',
  yellow: 'text-yellow-700',
  gray: 'text-gray-700',
};

export function Badge({ label, variant = 'purple' }: BadgeProps) {
  return (
    <View className={`px-2.5 py-1 rounded-full ${BADGE_STYLES[variant]}`}>
      <Text className={`text-xs font-medium ${BADGE_TEXT[variant]}`}>{label}</Text>
    </View>
  );
}
